/**
 * `docs/83-ONBOARDING-E-MIGRACAO-PLANO.md` §5.1–5.3 (P1) — a tela "Pra deixar o CICLO do seu
 * jeito", que aparece uma vez, depois que `executarOnboarding` já criou o tenant (nunca dentro da
 * tela de 3 respostas — §5.1 é explícito sobre isso).
 *
 * Só a Pergunta 1 nesta fase ("Onde estão seus clientes hoje?"): decide para onde a pessoa vai
 * depois de responder. Pura e sem I/O (regra 5 do CLAUDE.md) — a página client usa para navegar
 * sem esperar resposta do servidor, e um teste de unidade cobre a tabela inteira sem precisar de
 * banco.
 */

import type { AcaoDoMotor } from '@/core/ciclo/acao-do-motor'
import type { AcaoDeCompletude } from '@/core/comanda/completude-do-lucro'

/** As cinco respostas da Pergunta 1, na ordem em que aparecem na tela. */
export const BASES_EM = ['cabeca_caderno', 'whatsapp_contatos', 'planilha', 'outro_sistema', 'comecando_agora'] as const

export type BaseEm = (typeof BASES_EM)[number]

/**
 * A sub-seleção de "Em outro sistema" (§5.2). Trinks fica na lista mesmo com o passo a passo
 * dedicado fora da fila (decisão de 28/09, §9): a pessoa pode ter vindo de lá mesmo sem o P2
 * ainda existir para ele — a resposta ainda vale para a métrica de quantas contas vêm de outro
 * sistema, que é o ganho desta pergunta.
 */
export const SISTEMAS_ANTERIORES = ['appbarber', 'trinks', 'belasis', 'barbup', 'booksy', 'outro'] as const

export type SistemaAnterior = (typeof SISTEMAS_ANTERIORES)[number]

/**
 * Tabela do §5.3. Cabeça/caderno e WhatsApp/contatos caem no mesmo lugar — nenhum dos dois é
 * planilha, e `ja-atendo` já resolve os dois (digitar de memória). "Outro sistema" leva à tela
 * placeholder de P2 (roteamento pronto agora, conteúdo completo é o próximo ticket). "Começando
 * agora" pula a importação inteira — não tem base para trazer.
 */
export function rotaAposResponderPerfil(baseEm: BaseEm): string {
  switch (baseEm) {
    case 'cabeca_caderno':
    case 'whatsapp_contatos':
      return '/admin/clientes/ja-atendo'
    case 'planilha':
      return '/admin/clientes/importar'
    case 'outro_sistema':
      return '/admin/clientes/vindo-de-outro-sistema'
    case 'comecando_agora':
      return '/admin/hoje'
  }
}

/** Pular (o botão do topo ou o de cada pergunta) sempre leva para o mesmo lugar: o painel. */
export const ROTA_AO_PULAR_PERFIL = '/admin/hoje'

// ---------------------------------------------------------------------------------------------
// P5 (docs/83 §5.2) — Perguntas 2 e 3, SÓ com efeito real. A regra do plano: "se uma resposta não
// mudasse nada, a pergunta não existiria" e "só entram quando o efeito existir — senão a copy de
// incentivo mente".
// ---------------------------------------------------------------------------------------------

/**
 * Pergunta 2. "Só eu" DESLIGA o módulo de equipe e comissão (reversível pelo dono em Config); "Eu e
 * mais gente" não muda nada — a resposta nunca pode LIBERAR o que o plano não libera. Por isso a copy
 * só promete o efeito de "Só eu".
 */
export const TAMANHOS = ['so_eu', 'com_equipe'] as const
export type Tamanho = (typeof TAMANHOS)[number]

/**
 * Pergunta 3. Só as dores que JÁ têm cartão na Central de Ações — é o que torna verdade "aparece em
 * primeiro no seu painel". O §5.2 listava quatro; "gente que marca e não vem" e "responder WhatsApp
 * o dia inteiro" não têm cartão hoje, e ficam fora até ter (pergunta em DECISOES 29/09).
 */
export const DORES = ['cliente_some', 'quanto_sobra'] as const
export type Dor = (typeof DORES)[number]

// Tipado pelas uniões de quem EMITE o cartão: renomear um cartão quebra o typecheck aqui, em vez de
// a dor parar de priorizar calada. 'recuperar' nasce em server/ (regra 5), e tem guarda própria.
type ChaveDaDor = AcaoDoMotor['chave'] | AcaoDeCompletude['chave'] | 'recuperar'

const CARTOES_DA_DOR: Record<Dor, readonly ChaveDaDor[]> = {
  cliente_some: ['recuperar', 'motor-de-olho', 'motor-sem-ultima-visita'],
  quanto_sobra: ['completude-taxa', 'completude-custo-fixo', 'completude-material'],
}

/** Lê a dor gravada em `tenants.settings.dor_principal`; qualquer outra coisa = sem preferência. */
export function lerDorPrincipal(settings: unknown): Dor | null {
  const v = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).dor_principal : null
  return typeof v === 'string' && (DORES as readonly string[]).includes(v) ? (v as Dor) : null
}

/**
 * Os cartões da dor escolhida vão para o topo, NA ORDEM em que já estavam; o resto segue igual.
 * Sem cartão da dor na lista (a conta não tem nada disso para fazer agora), nada muda — a copy diz
 * "quando tiver", não "sempre".
 */
export function priorizarPelaDor<T extends { chave: string }>(acoes: readonly T[], dor: Dor | null): T[] {
  if (!dor) return [...acoes]
  const da = new Set<string>(CARTOES_DA_DOR[dor])
  return [...acoes.filter((a) => da.has(a.chave)), ...acoes.filter((a) => !da.has(a.chave))]
}

// ---------------------------------------------------------------------------------------------
// P6 (docs/83 §5.5) — "O que muda por aqui", para quem vem de outro sistema. Cada frase só aparece
// se for VERDADE no plano da conta: a página pública e a comanda/fidelidade podem estar fora do
// plano ou desligadas pelo dono. O ritmo do Motor é sempre ligado; pacote não tem trava de módulo.
// Sem nomear concorrente e sem comparação — só o que a pessoa vai encontrar aqui.
// ---------------------------------------------------------------------------------------------

export type RecursosDaConta = { paginaPublica: boolean; comanda: boolean; fidelidade: boolean }

export function oQueMudaPorAqui(r: RecursosDaConta): string[] {
  const frases: string[] = []
  if (r.paginaPublica) frases.push('Seu cliente marca pelo seu link, sem baixar app nenhum.')
  frases.push('Você não escolhe prazo de retorno: o CICLO calcula o ritmo de cada cliente pelas visitas.')

  const conhecidos = [...(r.comanda ? ['comanda'] : []), 'pacote', ...(r.fidelidade ? ['fidelidade'] : [])]
  const lista =
    conhecidos.length === 1 ? conhecidos[0]! : `${conhecidos.slice(0, -1).join(', ')} e ${conhecidos[conhecidos.length - 1]!}`
  const verbo = conhecidos.length === 1 ? 'funciona' : 'funcionam'
  frases.push(`${lista.charAt(0).toUpperCase()}${lista.slice(1)} ${verbo} do jeito que você já conhece.`)
  return frases
}
