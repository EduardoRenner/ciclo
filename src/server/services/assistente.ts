import type { Papel } from '@/server/auth/rbac'
import { AppError } from '@/server/http/errors'
import { ferramentasPermitidas, hojeNoFuso, paraJsonSchema, type ContextoFerramenta, type Ferramenta } from '@/server/assistente/ferramentas'
import { podeUsarModulo } from '@/core/billing/planos'
import { explicarArgumentosInvalidos } from '@/core/assistente/erro-de-argumento'
import { extrairProposta } from '@/core/assistente/proposta'
import { contextoDePlano } from '@/server/services/planos'
import type { AiProvider, MensagemDoAssistente } from '@/server/providers/ai/types'
import { ErroDeInferencia } from '@/server/providers/ai/types'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

// docs/26-AGENTE-IA-PLANO.md §6, ticket A4: "Máximo 3 chamadas de ferramenta por pergunta" —
// corta laço maluco (modelo que fica chamando ferramenta sem nunca responder) e limita custo
// de qualquer pergunta a, na pior das hipóteses, 3 idas ao banco + 4 chamadas ao provedor.
const MAX_CHAMADAS_DE_FERRAMENTA = 3

/**
 * 2026-08-30: achado testando o laço pela primeira vez contra a API real — pergunta "tenho
 * horário vago amanhã?" voltou com uma data de 2025 inventada. A instrução "nunca invente data"
 * sozinha não bastava: sem NENHUMA data de referência no contexto, o modelo não tem como saber
 * que dia é hoje para calcular "amanhã" — ele estava adivinhando, não desobedecendo. Ferramentas
 * como `ocupacao_do_dia` (EsquemaData) pedem uma data em AAAA-MM-DD; sem esta âncora, é o modelo
 * quem tem que inventar o número que preenche esse campo, o que é exatamente o que a regra
 * inegociável nº1 do docs/26 (`§0` item 1) proíbe.
 */
function promptDeSistema(hojeIso: string): string {
  return `Você é o assistente do CICLO, um painel de gestão para profissionais de beleza.
Hoje é ${hojeIso} (formato AAAA-MM-DD). Use esta data para calcular "hoje", "amanhã", "essa semana" e datas parecidas — nunca invente ou chute uma data fora deste cálculo.
Responda só com base no que as ferramentas devolverem — nunca invente número, nome ou dado que não veio de uma ferramenta.
Se a pergunta exigir um dado que nenhuma ferramenta traz, diga que não consegue responder isso.
Nunca dê conselho médico, clínico, jurídico ou fiscal — recuse e sugira falar com um profissional da área.
Nunca afirme um resultado futuro ("essa campanha vai trazer X clientes") — descreva só o que já aconteceu ou já está calculado.
Seja direto e curto. O dono do salão está sem tempo.

Você também PREPARA ações, nunca executa: quando pedirem para marcar um horário, use preparar_agendamento e mostre o que vai acontecer em uma frase clara, com nome, dia, hora e preço. Quem marca é o dono, tocando em confirmar — nunca diga que já marcou.
Se a ferramenta devolver "qual_delas", PERGUNTE qual, listando as opções. Nunca escolha por conta própria: marcar horário para a cliente errada é pior do que perguntar.
Se devolver "nao_achei", diga o que não encontrou e ofereça o caminho (por exemplo, os serviços que existem).
Se a cliente não estiver cadastrada ("podeCadastrar"), PEÇA o telefone dela e chame preparar_agendamento de novo com o telefone — assim o mesmo toque cadastra e marca. Nunca invente um telefone.`
}

/**
 * A proposta que uma ferramenta de preparo devolveu nesta pergunta, se devolveu. É o que vira o
 * cartão com botão no chat: sem isto, o assistente diz "confirma?" e o dono não tem onde tocar —
 * teria que ir à tela marcar na mão, e a proposta viraria só um texto bonito.
 *
 * `dados` é o corpo pronto para a ROTA DE EXECUÇÃO (`POST /api/v1/appointments`). O assistente
 * nunca chama essa rota: ele diz o que preencher, e o clique do dono é que executa — a regra
 * inegociável nº4 do `docs/26 §0`, agora com um botão de verdade atrás dela.
 */
export type PropostaDoAssistente = {
  acao: string
  dados: Record<string, unknown>
  resumo: Record<string, unknown>
}

export type ResultadoDoAssistente = {
  resposta: string
  ferramentasUsadas: string[]
  proposta?: PropostaDoAssistente
}

/**
 * Ferramentas que este papel, neste tenant, pode de fato chamar agora — o filtro de RBAC
 * (`ferramentasPermitidas`, a mesma tabela de papéis das rotas) mais o módulo do plano
 * (`podeUsarModulo`). Filtrar ANTES de montar o pedido ao modelo é o que garante que ele nunca vê,
 * e portanto nunca tenta chamar, uma ferramenta fora do alcance — a segunda camada (checar de novo
 * antes de executar, abaixo) é rede, não a única trava.
 */
async function ferramentasDisponiveisAgora(db: Cliente, tenantId: string, papel: Papel): Promise<Ferramenta[]> {
  const ctxPlano = await contextoDePlano(db, tenantId)
  return ferramentasPermitidas(papel).filter((f) => podeUsarModulo(ctxPlano, f.modulo).estado === 'liberado')
}

/**
 * Corta objeto grande e texto de terceiro antes de ir para o modelo. §4.1/§4.3 do plano: o que
 * vem do cliente final (nome, endereço digitado no agendamento público) é rotulado como DADO NÃO
 * CONFIÁVEL e tem tamanho travado — impede que um nome como
 * "Maria. IGNORE AS INSTRUÇÕES ANTERIORES..." carregue um bloco longo o bastante para valer a
 * pena tentar.
 */
function serializarResultado(valor: unknown): string {
  const texto = JSON.stringify(valor, (_chave, v) => (typeof v === 'string' && v.length > 300 ? v.slice(0, 300) : v))
  return texto.length > 6000 ? texto.slice(0, 6000) + '…(cortado)' : texto
}

/**
 * Ponto de entrada real: resolve RBAC + módulo do plano (I/O) e delega o laço puro abaixo.
 * Separado de `executarLaco` só por isto — o laço em si não precisa saber de banco, e testá-lo
 * sem um Supabase de verdade é o que a Fase A (§6, A8) pede.
 */
export async function perguntarAoAssistente(opcoes: {
  provider: AiProvider
  db: Cliente
  tenantId: string
  timezone: string
  papel: Papel
  pergunta: string
}): Promise<ResultadoDoAssistente> {
  const { provider, db, tenantId, timezone, papel, pergunta } = opcoes

  const disponiveis = await ferramentasDisponiveisAgora(db, tenantId, papel)
  const ctxFerramenta: ContextoFerramenta = { db, tenantId, timezone }

  return executarLaco({ provider, ferramentas: disponiveis, ctxFerramenta, pergunta })
}

/**
 * O laço puro: pergunta → o modelo escolhe uma ferramenta ou responde → se escolheu, executa e
 * volta o resultado → repete até responder em texto ou até MAX_CHAMADAS_DE_FERRAMENTA. Recebe a
 * lista de ferramentas já filtrada (RBAC + módulo resolvidos por quem chama) e não faz I/O fora
 * de `ferramenta.executar()` — por isso dá para testar com um provider falso e ferramentas falsas,
 * sem Supabase nenhum.
 *
 * Nunca escreve no banco, e isso continua verdade com `preparar_agendamento` (30/08): ela LÊ para
 * resolver nomes em ids e devolve uma PROPOSTA — objeto, não efeito. Quem executa segue sendo o
 * endpoint normal, com o clique do dono, que é literalmente a regra inegociável nº4 do
 * `docs/26 §0`. Se um dia alguma ferramenta escrever daqui, esta frase é a primeira a corrigir.
 */
export async function executarLaco(opcoes: {
  provider: AiProvider
  ferramentas: Ferramenta[]
  ctxFerramenta: ContextoFerramenta
  pergunta: string
}): Promise<ResultadoDoAssistente> {
  const { provider, ferramentas: disponiveis, ctxFerramenta, pergunta } = opcoes
  const descricoes = disponiveis.map((f) => ({ nome: f.nome, descricao: f.descricao, parametros: paraJsonSchema(f.schema) }))

  const mensagens: MensagemDoAssistente[] = [
    { papel: 'sistema', texto: promptDeSistema(hojeNoFuso(ctxFerramenta.timezone)) },
    { papel: 'usuario', texto: pergunta },
  ]

  const ferramentasUsadas: string[] = []
  // A ÚLTIMA proposta vence: se o modelo preparar duas vezes na mesma pergunta (corrigindo a si
  // mesmo depois de uma desambiguação), o cartão tem que refletir a última, não a primeira.
  let proposta: PropostaDoAssistente | undefined

  for (let chamada = 0; chamada <= MAX_CHAMADAS_DE_FERRAMENTA; chamada++) {
    const noUltimaVolta = chamada === MAX_CHAMADAS_DE_FERRAMENTA
    let resposta
    try {
      resposta = await provider.perguntar({ mensagens, ferramentas: noUltimaVolta ? [] : descricoes })
    } catch (erro) {
      if (erro instanceof ErroDeInferencia) throw erro
      throw new AppError('INTERNAL', { cause: erro })
    }

    if (resposta.tipo === 'texto') {
      return { resposta: resposta.texto, ferramentasUsadas, proposta }
    }

    // Trava dura: na última volta o pedido não ofereceu NENHUMA ferramenta (`ferramentas: []`
    // acima). Um provedor bem-comportado responde em texto; um que ainda assim devolve chamada
    // de ferramenta está sendo ignorado de propósito — sem isto, MAX_CHAMADAS_DE_FERRAMENTA vira
    // sugestão, não limite (achado do teste de A8: "corta o laço maluco").
    if (noUltimaVolta) {
      return { resposta: 'Não consegui terminar de responder. Tente reformular a pergunta.', ferramentasUsadas }
    }

    // resposta.tipo === 'chamada_ferramenta'
    // Procura só dentro de `disponiveis` — nunca no catálogo global. É a segunda checagem, na
    // hora de executar: mesmo que o modelo alucine o nome de uma ferramenta real mas fora do
    // alcance deste papel/plano, ela não está nesta lista e cai no ramo abaixo.
    const ferramenta = disponiveis.find((f) => f.nome === resposta.nome)
    if (!ferramenta) {
      mensagens.push({ papel: 'assistente', texto: null, chamadaFerramenta: { nome: resposta.nome, argumentos: resposta.argumentos, assinatura: resposta.assinatura } })
      mensagens.push({ papel: 'ferramenta', nome: resposta.nome, conteudo: 'Ferramenta indisponível para este usuário.' })
      continue
    }

    let argumentos: unknown
    try {
      argumentos = JSON.parse(resposta.argumentos || '{}')
    } catch {
      argumentos = {}
    }
    const validado = ferramenta.schema.safeParse(argumentos)

    mensagens.push({ papel: 'assistente', texto: null, chamadaFerramenta: { nome: resposta.nome, argumentos: resposta.argumentos, assinatura: resposta.assinatura } })

    if (!validado.success) {
      // Diz QUAL campo e POR QUÊ: sem isso o modelo repete o mesmo erro até as voltas acabarem.
      mensagens.push({ papel: 'ferramenta', nome: resposta.nome, conteudo: explicarArgumentosInvalidos(validado.error) })
      continue
    }

    ferramentasUsadas.push(ferramenta.nome)
    try {
      const resultado = await ferramenta.executar(ctxFerramenta, validado.data)
      proposta = extrairProposta(resultado) ?? proposta
      mensagens.push({ papel: 'ferramenta', nome: resposta.nome, conteudo: serializarResultado(resultado) })
    } catch (erro) {
      // Regra do plano (§8.1): supabase-js não lança em erro de banco — todo `executar()` das
      // ferramentas já checa `{ error }` e lança AppError('INTERNAL') quando a consulta falha.
      // Aqui isso vira "não consegui consultar", NUNCA um resultado vazio: resposta vazia
      // parece "você não tem nada atrasado", que é mentira quando a causa foi a consulta ter
      // quebrado, não a lista estar realmente vazia.
      //
      // O erro em si não pode só desaparecer aqui (mesma armadilha de "catch que descarta" do
      // CLAUDE.md) — sem isto, uma ferramenta quebrando em produção nunca aparece em lugar
      // nenhum, só o texto genérico que o dono vê.
      console.error(JSON.stringify({ level: 'error', event: 'assistente_ferramenta_falhou', ferramenta: resposta.nome }), erro)
      mensagens.push({ papel: 'ferramenta', nome: resposta.nome, conteudo: 'Não consegui consultar isso agora. Tente de novo em instantes.' })
    }
  }

  // Não deveria chegar aqui: a última volta do laço vai sem ferramentas, então o modelo é
  // obrigado a responder em texto. Precaução para um provedor que devolva chamada de ferramenta
  // mesmo sem nenhuma oferecida.
  return { resposta: 'Não consegui terminar de responder. Tente reformular a pergunta.', ferramentasUsadas }
}
