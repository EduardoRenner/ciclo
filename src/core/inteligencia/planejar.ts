import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import { resolverPorNome } from '@/core/assistente/resolver'
import { decomporVariacao } from '@/core/inteligencia/explicar'
import { simularContratacao, simularPreco } from '@/core/inteligencia/simular'
import { semAcento } from '@/core/text/normalizar'
import type { Entendimento, Entidades, Intencao } from '@/core/inteligencia/entender'
import {
  falarAgendaDeHoje,
  falarAlertasDeEstoque,
  falarAtendidoHoje,
  falarConfirmacoesDeHoje,
  falarFaturamento,
  falarNaoAchei,
  falarOcupacaoDoDia,
  falarOrcamentosSemResposta,
  falarPrimeirosParaRecuperar,
  falarProcurasEmDiaFechado,
  falarPropostaPronta,
  falarQualDelas,
  falarSimulacaoDeContratacao,
  falarSimulacaoDePreco,
  falarQuemCostumaVoltar,
  falarVariacao,
  falarQuantoDeixou,
  falarCostume,
  falarChamadaPronta,
  falarQuemChamarPrimeiro,
  falarSobra,
  falarSumidosHaMaisDe,
  falarTelefone,
  falarTotalParaRecuperar,
  falarUltimaVisita,
  listarComE,
  reais,
  rotuloDoDia,
} from '@/core/inteligencia/falar'

/**
 * MI-2 (docs/85 §2.2, §4) — o que o Motor FAZ com o que entendeu.
 *
 * Duas decisões, as duas puras:
 * - `planejar`: primeiro turno. Da intenção + entidades para UMA chamada de ferramenta (a mesma
 *   lista que o Gemini usava, com a mesma permissão e o mesmo plano, filtrados por quem chama), ou
 *   direto para um texto quando não há o que consultar: não entendeu, empate, falta um dado
 *   ("pra quando?"), ferramenta fora do alcance, ou pedido que o Motor ainda não sabe fazer.
 * - `continuar`: depois que a ferramenta rodou. Lê o resultado (validado — nunca confia na forma)
 *   e fala, ou pede o segundo passo (buscar a pessoa → abrir o histórico dela).
 *
 * O Motor nunca inventa: todo número sai do resultado da ferramenta, toda frase sai de `falar.ts`.
 * Quando falta algo, pergunta. Quando o resultado não é o esperado, diz que não conseguiu.
 */

export type Chamada = { nome: string; argumentos: Record<string, unknown> }
export type Passo = { tipo: 'ferramenta'; chamada: Chamada } | { tipo: 'texto'; texto: string }
export type Etapa = { chamada: Chamada; resultado: string }

export type ContextoDoMotor = {
  /** A pergunta como a pessoa escreveu (a anotação ditada sai daqui, palavra por palavra). */
  texto: string
  hoje: Temporal.PlainDate
  timezone: string
  /** Nomes das ferramentas que este papel, neste plano, pode chamar AGORA. */
  disponiveis: ReadonlySet<string>
  /**
   * O foco da pergunta ANTERIOR, quando esta só continua aquela (MI-4): "qual o telefone da Maria?"
   * → "qual delas?" → "a Silva" tem que responder o telefone, e "a Silva" sozinha não diz isso.
   */
  foco?: Foco
}

const FALHOU = 'Não consegui consultar isso agora. Tente de novo em instantes.'
export const FORA_DO_ALCANCE = 'Isso não está liberado no seu acesso ou no seu plano.'

const ROTULO: Record<Intencao, string> = {
  agenda_de_hoje: 'a agenda de hoje',
  quem_sumiu: 'quem passou da hora de voltar',
  historico_cliente: 'o histórico de alguém',
  faturamento: 'quanto faturou',
  sobra: 'quanto sobrou',
  ocupacao: 'horário vago',
  orcamentos: 'orçamentos parados',
  estoque: 'o estoque',
  agendar: 'marcar um horário',
  concluir_atendimento: 'concluir um atendimento',
  cadastrar_cliente: 'cadastrar alguém',
  item_na_comanda: 'lançar na comanda',
  nota_na_ficha: 'anotar na ficha',
  chamar_de_volta: 'chamar alguém de volta',
  por_que: 'o porquê de uma variação',
  simular: 'uma simulação',
  saudacao: 'conversa',
  ajuda: 'ajuda',
}

/** O que dá para sugerir, na ordem de utilidade — só o que as ferramentas liberadas atendem. */
const SUGESTOES: ReadonlyArray<readonly [string, string]> = [
  ['clientes_para_recuperar', 'quem sumiu'],
  ['resumo_de_hoje', 'como está o dia'],
  ['ocupacao_do_dia', 'tem horário vago amanhã'],
  ['faturamento_do_periodo', 'quanto faturei este mês'],
  ['buscar_cliente', 'quando a Maria veio pela última vez'],
  ['orcamentos_parados', 'tem orçamento sem resposta'],
  ['alertas_de_estoque', 'o que está acabando no estoque'],
]

function sugestoes(ctx: ContextoDoMotor): string {
  const frases = SUGESTOES.filter(([f]) => ctx.disponiveis.has(f)).map(([, frase]) => `"${frase}"`)
  return frases.length > 0 ? ` Dá para perguntar, por exemplo: ${listarComE(frases.slice(0, 3))}.` : ''
}

const ferramenta = (nome: string, argumentos: Record<string, unknown> = {}): Passo => ({ tipo: 'ferramenta', chamada: { nome, argumentos } })
const texto = (t: string): Passo => ({ tipo: 'texto', texto: t })

function seDisponivel(ctx: ContextoDoMotor, nome: string, argumentos: Record<string, unknown> = {}): Passo {
  return ctx.disponiveis.has(nome) ? ferramenta(nome, argumentos) : texto(FORA_DO_ALCANCE)
}

// ---------------------------------------------------------------------------------------------
// Entidades → argumentos
// ---------------------------------------------------------------------------------------------

const PREPOSICOES_DE_POSSE = new Set(['da', 'do', 'de'])

/** O nome de quem: o trecho depois de "da/do/de"; senão o primeiro trecho. */
function quem(e: Entidades): string | null {
  const t = e.trechos.find((x) => x.antes !== null && PREPOSICOES_DE_POSSE.has(x.antes)) ?? e.trechos[0]
  return t ? t.palavras.join(' ') : null
}

/** Os trechos que não são `quem` — o serviço, o item. */
function oResto(e: Entidades, nomeDeQuem: string | null): string | null {
  const outros = e.trechos.filter((t) => t.palavras.join(' ') !== nomeDeQuem).map((t) => t.palavras.join(' '))
  return outros.length > 0 ? outros.join(' ') : null
}

/** Telefone brasileiro no texto cru: DDD + 8 ou 9 dígitos, com ou sem máscara. */
function telefoneNoTexto(t: string): string | null {
  const m = /(?:\+?55\s*)?\(?(\d{2})\)?[\s.-]*(9?\d{4})[\s.-]*(\d{4})\b/.exec(t)
  return m ? `${m[1]}${m[2]}${m[3]}` : null
}

/** A anotação exatamente como foi ditada: o que vem depois de "que" (após o nome) ou de ":". */
function anotacaoNoTexto(t: string, nome: string | null): string | null {
  const depoisDoNome = nome ? t.slice(Math.max(0, t.indexOf(nome) + nome.length)) : t
  const m = /(?:^|\s)que\s+(.+)$/is.exec(depoisDoNome) ?? /:\s*(.+)$/s.exec(t)
  const a = m?.[1]?.trim()
  return a && a.length >= 2 ? a : null
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function mesAtualIso(hoje: Temporal.PlainDate) {
  return `${hoje.year}-${String(hoje.month).padStart(2, '0')}`
}

function rotuloDoMes(mes: string, hoje: Temporal.PlainDate, faturamento: boolean): string {
  if (mes === mesAtualIso(hoje)) return faturamento ? 'neste mês, até agora' : 'neste mês'
  const [ano, m] = mes.split('-').map(Number)
  return `em ${MESES[m! - 1]} de ${ano}`
}

/**
 * O caixa responde por MÊS (`faturamento_do_periodo`). Pergunta por semana ou por um dia que não é
 * hoje ganha o mês que contém o período — com aviso dito, nunca um número de mês fingindo ser da
 * semana.
 */
function mesDoCaixa(e: Entidades, hoje: Temporal.PlainDate): { mes: string; aviso: string } {
  const p = e.periodo
  if (!p) return { mes: mesAtualIso(hoje), aviso: '' }
  if (p.tipo === 'mes') return { mes: p.mes, aviso: '' }
  const dia = Temporal.PlainDate.from(p.tipo === 'dia' ? p.data : p.inicio)
  return { mes: mesAtualIso(dia), aviso: `Por ${p.tipo === 'dia' ? 'dia' : 'semana'} eu ainda não separo, então vai o mês inteiro. ` }
}

function diaPedido(e: Entidades): string | null {
  return e.periodo?.tipo === 'dia' ? e.periodo.data : null
}

// ---------------------------------------------------------------------------------------------
// Primeiro turno
// ---------------------------------------------------------------------------------------------

export function planejar(ent: Entendimento, ctx: ContextoDoMotor): Passo {
  if (ent.tipo === 'nao_entendi') return texto(`Ainda não sei responder isso.${sugestoes(ctx)}`)
  if (ent.tipo === 'ambiguo') return texto(`Você quer saber ${ROTULO[ent.opcoes[0]]} ou ${ROTULO[ent.opcoes[1]]}?`)

  const e = ent.entidades
  const hojeIso = ctx.hoje.toString()

  switch (ent.intencao) {
    case 'saudacao':
      return texto(/obrigad|valeu|brigad/i.test(ctx.texto) ? 'Por nada.' : `Oi! O que você quer saber?${sugestoes(ctx)}`)
    case 'ajuda':
      return texto(`Respondo sobre a sua agenda, quem passou da hora de voltar, o caixa e o estoque, e preparo horário, cadastro e anotação para você confirmar.${sugestoes(ctx)}`)
    // MI-5: o porquê é do FATURAMENTO — é o que dá para decompor em conta. Sobre outra coisa, a
    // resposta diz isso antes (ver `continuar`), em vez de fingir que explicou o que foi perguntado.
    case 'por_que':
      return seDisponivel(ctx, 'explicar_variacao', e.periodo?.tipo === 'mes' ? { mes: e.periodo.mes } : {})
    // MI-6: a premissa é do dono e o preço também — o Motor só faz a conta do que ele disse.
    case 'simular': {
      const t = semAcento(ctx.texto)
      if (/contrat/.test(t)) {
        const custo = e.valoresCents?.at(-1) ?? e.valorCents
        if (custo === undefined) return texto('Quanto essa pessoa custaria por mês, com tudo? Por exemplo: "e se eu contratar alguém por R$ 2.500?"')
        return seDisponivel(ctx, 'simular_contratacao', { custoMensalCents: custo })
      }
      // Dia extra: o dado é a procura em dia fechado (docs/84 §2.2), nunca um R$.
      if (/\babr(ir|isse|o)\b|dia a mais/.test(t)) return seDisponivel(ctx, 'procuras_sem_horario')
      const servico = e.trechos.map((x) => x.palavras.filter((p) => !/\d/.test(p)).join(' ')).filter(Boolean).join(' ')
      if (!servico) return texto('De qual serviço? Por exemplo: "e se eu subir o corte para R$ 55?"')
      // "de R$ 45 para R$ 55": o preço novo é o ÚLTIMO valor da frase, não o primeiro.
      const novo = e.valoresCents && e.valoresCents.length > 0 ? e.valoresCents.at(-1) : e.valorCents
      if (novo === undefined && e.percentualBps === undefined) return texto(`Para quanto? Por exemplo: "e se eu subir ${servico} para R$ 55?" ou "10% a mais".`)
      const reduz = /\b(baix|reduz|diminu|abaix)/.test(t)
      return seDisponivel(ctx, 'simular_preco', novo !== undefined ? { servico, precoNovoCents: novo } : { servico, percentualBps: e.percentualBps, aumento: !reduz })
    }

    case 'agenda_de_hoje': {
      const dia = diaPedido(e)
      if (dia && dia !== hojeIso) return seDisponivel(ctx, 'ocupacao_do_dia', { data: dia })
      if (e.periodo && e.periodo.tipo !== 'dia') return texto('A agenda eu resumo por dia. Pergunte por um dia, como "tem vaga sexta?".')
      return seDisponivel(ctx, 'resumo_de_hoje')
    }
    case 'ocupacao': {
      if (/mais fraco|mais parado|mais vazio/i.test(ctx.texto) && !diaPedido(e)) {
        return texto('Ainda não comparo os dias da semana entre si. Pergunte por um dia, como "tem vaga sexta?".')
      }
      if (e.periodo && e.periodo.tipo !== 'dia') return texto('Horário vago eu olho por dia. Pergunte por um dia, como "tem vaga sexta?".')
      return seDisponivel(ctx, 'ocupacao_do_dia', { data: diaPedido(e) ?? hojeIso })
    }
    case 'quem_sumiu':
      return seDisponivel(ctx, 'clientes_para_recuperar')
    case 'orcamentos':
      return seDisponivel(ctx, 'orcamentos_parados')
    case 'estoque':
      return seDisponivel(ctx, 'alertas_de_estoque')

    case 'faturamento':
    case 'sobra': {
      // "Quanto entrou hoje": o número do dia que existe é o ATENDIDO (preço de tabela), e a frase
      // diz isso. Não é o caixa do dia — esse mora na tela do caixa.
      if (ent.intencao === 'faturamento' && diaPedido(e) === hojeIso) return seDisponivel(ctx, 'resumo_de_hoje')
      return seDisponivel(ctx, 'faturamento_do_periodo', { mes: mesDoCaixa(e, ctx.hoje).mes })
    }

    case 'historico_cliente': {
      const nome = quem(e)
      if (!nome) return texto('De quem? Me diga o nome.')
      return seDisponivel(ctx, 'buscar_cliente', { termo: nome })
    }

    case 'agendar': {
      const dia = diaPedido(e)
      if (!dia || !e.hora) return texto('Pra quando? Diga o dia e a hora, por exemplo: "marca a Joana amanhã às 15h pra escova".')
      // "com a Juliana" é a profissional; o primeiro dos outros trechos é quem vai ser atendido, e o
      // resto é o serviço. Número solto (telefone) não entra em nome nenhum.
      const semNumero = e.trechos.map((t) => ({ ...t, palavras: t.palavras.filter((p) => !/\d/.test(p)) })).filter((t) => t.palavras.length > 0)
      const comQuem = semNumero.find((t) => t.antes === 'com')
      const [primeiro, ...resto] = semNumero.filter((t) => t !== comQuem)
      if (!primeiro) return texto('Pra quem? Diga o nome e o serviço, por exemplo: "marca a Joana amanhã às 15h pra escova".')
      if (resto.length === 0) return texto(`Qual serviço para ${primeiro.palavras.join(' ')}?`)
      const telefone = telefoneNoTexto(ctx.texto)
      return seDisponivel(ctx, 'preparar_agendamento', {
        cliente: primeiro.palavras.join(' '),
        servico: resto.map((t) => t.palavras.join(' ')).join(' '),
        quando: `${dia}T${e.hora}`,
        ...(comQuem ? { profissional: comQuem.palavras.join(' ') } : {}),
        ...(telefone ? { telefone } : {}),
      })
    }
    case 'concluir_atendimento': {
      const nome = quem(e)
      if (!nome) return texto('Concluir o atendimento de quem?')
      const dia = diaPedido(e)
      return seDisponivel(ctx, 'preparar_conclusao_de_atendimento', { cliente: nome, ...(dia ? { data: dia } : {}) })
    }
    case 'cadastrar_cliente': {
      const telefone = telefoneNoTexto(ctx.texto)
      const nome = e.trechos
        .map((t) => t.palavras.filter((p) => !/\d/.test(p)).join(' '))
        .filter((n) => n.length > 0)
        .join(' ')
      if (!nome) return texto('Qual o nome da pessoa?')
      // A ferramenta não aceita cadastro sem telefone, e nunca inventamos um.
      if (!telefone) return texto(`Qual o telefone de ${nome}? Sem ele eu não preparo o cadastro.`)
      return seDisponivel(ctx, 'preparar_cadastro_de_cliente', { nome, telefone })
    }
    case 'item_na_comanda': {
      const nome = quem(e)
      const item = oResto(e, nome)
      if (!nome || !item) return texto('Diga o que lançar e na comanda de quem, por exemplo: "lança uma hidratação na comanda da Ana".')
      const dia = diaPedido(e)
      return seDisponivel(ctx, 'preparar_item_na_comanda', { cliente: nome, item, ...(dia ? { data: dia } : {}) })
    }
    case 'chamar_de_volta': {
      const nome = quem(e)
      if (!nome) return texto('Chamar quem? Diga o nome, por exemplo "chama a Maria", ou pergunte antes "quem eu chamo primeiro?" e depois diga "resolve".')
      return seDisponivel(ctx, 'preparar_chamada_de_volta', { cliente: nome })
    }
    case 'nota_na_ficha': {
      const nome = quem(e)
      if (!nome) return texto('Anotar na ficha de quem?')
      const anotacao = anotacaoNoTexto(ctx.texto, nome)
      if (!anotacao) return texto(`O que eu anoto na ficha de ${nome}?`)
      return seDisponivel(ctx, 'preparar_nota_na_ficha', { cliente: nome, anotacao })
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Depois da ferramenta
// ---------------------------------------------------------------------------------------------

const Linha = z.object({ starts_at: z.string(), status: z.string(), clients: z.object({ name: z.string() }).nullable().optional() })
const ResumoHoje = z.object({ revenueTodayCents: z.number().int(), nextClient: Linha.nullable(), restOfDay: z.array(Linha) })
const Ocupacao = z.object({ data: z.string(), quantidadeDeAgendamentos: z.number(), taxaDeOcupacao: z.number(), temExpedienteCadastrado: z.boolean() })
const Recuperar = z.object({
  count: z.number(),
  totalValueCents: z.number().int(),
  items: z.array(z.object({ clientId: z.string().optional(), name: z.string(), valueCents: z.number().int(), lateDays: z.number() })),
})
const Caixa = z.object({
  month: z.string(),
  revenueCents: z.number().int(),
  profitCents: z.number().int(),
  taxasRespondidas: z.boolean().optional(),
  custoFixoRespondido: z.boolean().optional(),
})
const Orcamentos = z.array(z.object({ clientName: z.string(), diasParado: z.number() }))
const Estoque = z.array(z.object({ name: z.string(), precisaRecomprar: z.boolean(), validade: z.string() }))
const Clientes = z.array(z.object({ id: z.string(), name: z.string() }))
const SimulacaoPreco = z.object({
  status: z.literal('ok'),
  servico: z.string(),
  precoAtualCents: z.number().int(),
  precoNovoCents: z.number().int(),
  atendimentos: z.number().int(),
  dias: z.number().int(),
})
const SimulacaoContratacao = z.object({
  status: z.literal('ok'),
  custoMensalCents: z.number().int(),
  atendimentos: z.number().int(),
  sobraCents: z.number().int(),
  dias: z.number().int(),
})
const Lado = z.object({ rotulo: z.string(), atendimentos: z.number().int(), receitaCents: z.number().int() })
const Variacao = z.union([z.object({ status: z.literal('futuro') }), z.object({ status: z.literal('ok'), parcial: z.boolean(), agora: Lado, antes: Lado })])

/** A explicação inteira, a partir do resultado de `explicar_variacao`. `null` se não deu para ler. */
function explicacao(bruto: string, ent: Entendimento): { texto: string; caiuNoMesCorrente: boolean } | null {
  const r = ler(Variacao, bruto)
  if (!r) return null
  if (r.status === 'futuro') return { texto: 'Esse mês ainda não começou, então não há o que explicar.', caiuNoMesCorrente: false }
  const d = decomporVariacao(r.antes, r.agora)
  const sobreOutraCoisa = ent.tipo === 'intencao' && ent.sobre !== undefined && ent.sobre !== 'faturamento'
  const prefixo = sobreOutraCoisa ? 'O que eu já sei explicar é o faturamento. ' : ''
  return { texto: prefixo + falarVariacao({ antes: r.antes, agora: r.agora, ...d }), caiuNoMesCorrente: r.parcial && d.deltaCents < 0 }
}
const Historico = z.object({
  cliente: z.object({
    name: z.string(),
    phone_e164: z.string().nullable().optional(),
    visits_count: z.number().nullable().optional(),
    ltv_cents: z.number().int().nullable().optional(),
    last_visit_at: z.string().nullable().optional(),
  }),
  ultimosAgendamentos: z.array(z.object({ starts_at: z.string(), status: z.string() })),
  memoria: z.array(z.string()).optional(),
})
const Preparo = z.object({
  status: z.string(),
  oQue: z.string().optional(),
  termo: z.string().optional(),
  opcoes: z.array(z.string()).optional(),
  servicosDisponiveis: z.array(z.string()).optional(),
  podeCadastrar: z.boolean().optional(),
  motivo: z.string().optional(),
  cliente: z.union([z.string(), z.object({ nome: z.string() })]).optional(),
  resumo: z.record(z.string(), z.unknown()).optional(),
})

function ler<T>(schema: z.ZodType<T>, bruto: string): T | null {
  try {
    const r = schema.safeParse(JSON.parse(bruto))
    return r.success ? r.data : null
  } catch {
    return null
  }
}

function hora(iso: string, tz: string): string {
  const z = Temporal.Instant.from(iso).toZonedDateTimeISO(tz)
  return `${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`
}

function diaDe(iso: string, tz: string): Temporal.PlainDate {
  return Temporal.Instant.from(iso).toZonedDateTimeISO(tz).toPlainDate()
}

const dataBr = (d: Temporal.PlainDate) => `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`

const NOME_DO_QUE: Record<string, string> = {
  cliente: 'ninguém com o nome',
  servico: 'o serviço',
  profissional: 'ninguém da equipe com o nome',
  atendimento: 'atendimento em andamento de',
  comanda: 'comanda aberta de',
  item: 'serviço nem produto com o nome',
  produto: 'o produto',
}

function falarPreparo(nomeFerramenta: string, bruto: string, ctx: ContextoDoMotor): string {
  const r = ler(Preparo, bruto)
  if (!r) return FALHOU
  if (r.status === 'qual_delas') {
    const base = falarQualDelas(r.oQue === 'servico' ? 'serviço' : r.oQue === 'profissional' ? 'profissional' : 'pessoa', r.opcoes ?? [])
    // Até o MI-4 (contexto curto), responder só "a Juliana" é uma pergunta nova, sem o resto. O
    // jeito que funciona hoje é repetir o pedido com o nome — e a resposta diz isso.
    return r.oQue === 'profissional' ? `${base} É só pedir de novo com o nome, por exemplo: "... com a ${(r.opcoes ?? [''])[0]}".` : base
  }
  if (r.status === 'nao_achei') {
    const oQue = NOME_DO_QUE[r.oQue ?? ''] ?? 'o que você pediu:'
    const base = falarNaoAchei(oQue, r.termo ?? '', r.servicosDisponiveis ?? [])
    return r.podeCadastrar ? `${base} Se for alguém novo, diga o telefone junto, que eu já preparo o cadastro com o horário.` : base
  }
  if (r.status === 'ja_existe') {
    const nome = typeof r.cliente === 'object' ? r.cliente.nome : (r.cliente ?? '')
    return `Já existe uma ficha com esse telefone: ${nome}. Não preparei outra, para o histórico não se partir em dois.`
  }
  if (r.status === 'nao_da') {
    if (r.motivo === 'nenhum_atendimento_em_andamento') return 'Não há atendimento em andamento para concluir. Primeiro marque que a pessoa chegou, na agenda.'
    if (r.motivo === 'nenhuma_comanda_aberta') return 'Não há comanda aberta hoje. A comanda abre quando o atendimento é concluído.'
    const quemFoi = typeof r.cliente === 'string' ? r.cliente : ''
    if (r.motivo === 'fora_da_lista') return `${quemFoi} não está na lista de quem passou da hora de voltar: pode estar em dia, ou ainda sem ritmo medido.`
    if (r.motivo === 'pediu_para_nao_receber') return `${quemFoi} pediu para não receber mensagem. Não preparei nada.`
    return 'Não deu para preparar isso agora.'
  }
  if (r.status !== 'proposta') return FALHOU

  const resumo = r.resumo ?? {}
  const precoCents = typeof resumo.precoCents === 'number' ? resumo.precoCents : null
  switch (nomeFerramenta) {
    case 'preparar_agendamento': {
      const quando = typeof resumo.quando === 'string' ? Temporal.PlainDateTime.from(resumo.quando) : null
      const detalhe =
        quando && typeof resumo.cliente === 'string' && typeof resumo.servico === 'string'
          ? `${resumo.cliente}, ${resumo.servico}, ${rotuloDoDia(quando.toPlainDate(), ctx.hoje)} às ${String(quando.hour).padStart(2, '0')}:${String(quando.minute).padStart(2, '0')}` +
            (typeof resumo.profissional === 'string' ? ` com ${resumo.profissional}` : '') +
            (precoCents !== null ? `, ${reais(precoCents)}.` : '.')
          : ''
      return falarPropostaPronta(resumo.clienteNova ? 'cadastrar e marcar' : 'marcar', detalhe)
    }
    case 'preparar_conclusao_de_atendimento':
      return falarPropostaPronta('concluir', typeof resumo.cliente === 'string' ? `Concluir o atendimento de ${resumo.cliente}.` : '')
    case 'preparar_cadastro_de_cliente':
      return falarPropostaPronta('cadastrar', '')
    case 'preparar_item_na_comanda':
      return falarPropostaPronta('lançar', typeof resumo.Item === 'string' ? `${resumo.Item}${precoCents !== null ? `, ${reais(precoCents)} pelo catálogo` : ''}.` : '')
    case 'preparar_nota_na_ficha':
      return falarPropostaPronta('salvar a anotação', '')
    case 'preparar_chamada_de_volta':
      return falarChamadaPronta(typeof resumo.cliente === 'string' ? resumo.cliente : '')
    default:
      return falarPropostaPronta('seguir', '')
  }
}

/**
 * O que a pergunta quer, em uma palavra — decidido aqui, longe dos números.
 *
 * A mesma ferramenta responde perguntas diferentes: `clientes_para_recuperar` serve "quem eu chamo
 * primeiro?", "quanto dá para recuperar?" e "quem sumiu faz 60 dias?". Separar ESTA decisão (que
 * lê as palavras da pergunta) de `continuar` (que lê os números do resultado) é o que deixa cada
 * número ir para a frase que o nomeia certo, em `falar.ts` — e nunca encostar numa palavra de
 * entrada que, lida de perto, pareceria um rótulo (guarda `numero-de-hoje-nao-e-faturamento`).
 */
export type Foco =
  | 'atendido_do_dia'
  | 'confirmacoes'
  | 'visao_do_dia'
  | 'quem_primeiro'
  | 'estimativa_de_recuperacao'
  | 'sumidos_ha_dias'
  | 'lista_de_recuperacao'
  | 'telefone'
  | 'quanto_deixou'
  | 'ultima_visita'
  | 'costume'
  | 'sobra_do_mes'
  | 'caixa_do_mes'

export function focoDaPergunta(ent: Entendimento, texto: string): Foco {
  const intencao = ent.tipo === 'intencao' ? ent.intencao : null
  switch (intencao) {
    case 'faturamento':
      // "Quanto entrou hoje" cai no resumo do dia, e o número do dia é o ATENDIDO.
      return ent.tipo === 'intencao' && ent.entidades.periodo?.tipo === 'dia' ? 'atendido_do_dia' : 'caixa_do_mes'
    case 'sobra':
      return 'sobra_do_mes'
    case 'quem_sumiu':
      if (/primeir|chamo|chamar/i.test(texto)) return 'quem_primeiro'
      if (/\d+\s*dias/.test(texto)) return 'sumidos_ha_dias'
      if (/parado|dinheiro|quanto|recuper/i.test(texto)) return 'estimativa_de_recuperacao'
      return 'lista_de_recuperacao'
    case 'historico_cliente':
      if (/telefone|numero|número|whats|zap/i.test(texto)) return 'telefone'
      if (/gast|deix|pag/i.test(texto)) return 'quanto_deixou'
      if (/costum|com quem|quanto em quanto/i.test(texto)) return 'costume'
      return 'ultima_visita'
    default:
      if (/confirm/i.test(texto)) return 'confirmacoes'
      if (/atend/i.test(texto)) return 'atendido_do_dia'
      return 'visao_do_dia'
  }
}

export function continuar(ent: Entendimento, etapas: ReadonlyArray<Etapa>, ctx: ContextoDoMotor): Passo {
  const ultima = etapas[etapas.length - 1]
  if (!ultima) return planejar(ent, ctx)
  const { chamada, resultado } = ultima
  const e = ent.tipo === 'intencao' ? ent.entidades : null
  const foco = ctx.foco ?? focoDaPergunta(ent, ctx.texto)

  switch (chamada.nome) {
    case 'resumo_de_hoje': {
      const r = ler(ResumoHoje, resultado)
      if (!r) return texto(FALHOU)
      const pendentes = r.restOfDay.filter((l) => l.status === 'pending').map((l) => ({ nome: l.clients?.name ?? 'Cliente', hora: hora(l.starts_at, ctx.timezone) }))
      if (foco === 'atendido_do_dia') return texto(falarAtendidoHoje(r.revenueTodayCents))
      if (foco === 'confirmacoes') return texto(falarConfirmacoesDeHoje(pendentes))
      const proximo = r.nextClient ? { nome: r.nextClient.clients?.name ?? 'Cliente', hora: hora(r.nextClient.starts_at, ctx.timezone) } : null
      return texto(falarAgendaDeHoje({ proximo, restantes: r.restOfDay.length + (r.nextClient ? 1 : 0), pendentes, atendidoCents: r.revenueTodayCents }))
    }
    case 'ocupacao_do_dia': {
      const r = ler(Ocupacao, resultado)
      if (!r) return texto(FALHOU)
      return texto(
        falarOcupacaoDoDia({
          rotulo: rotuloDoDia(Temporal.PlainDate.from(r.data), ctx.hoje),
          quantidade: r.quantidadeDeAgendamentos,
          taxa: r.taxaDeOcupacao,
          temExpediente: r.temExpedienteCadastrado,
        }),
      )
    }
    case 'clientes_para_recuperar': {
      const r = ler(Recuperar, resultado)
      if (!r) return texto(FALHOU)
      // Segundo passo do "por que caiu?": a explicação da etapa anterior + quem costuma voltar.
      const anterior = etapas[etapas.length - 2]
      if (anterior?.chamada.nome === 'explicar_variacao') {
        const x = explicacao(anterior.resultado, ent)
        if (!x) return texto(FALHOU)
        const extra = falarQuemCostumaVoltar(r.count, r.totalValueCents)
        return texto(extra ? `${x.texto} ${extra}` : x.texto)
      }
      const primeiro = r.items[0]
      // "resolve" depois da lista: a primeira dela — a MESMA que "quem eu chamo primeiro?" nomeia.
      if (ent.tipo === 'intencao' && ent.intencao === 'chamar_de_volta') {
        if (!primeiro?.clientId) return texto('Ninguém passou da hora de voltar agora. Não há quem chamar.')
        return seDisponivel(ctx, 'preparar_chamada_de_volta', { clientId: primeiro.clientId })
      }
      switch (foco) {
        case 'quem_primeiro':
          return texto(falarQuemChamarPrimeiro(primeiro ? { nome: primeiro.name, valorCents: primeiro.valueCents, diasAtrasado: primeiro.lateDays } : null))
        case 'sumidos_ha_dias': {
          const dias = Number(/(\d+)\s*dias/.exec(ctx.texto)?.[1] ?? 0)
          // Continuação sem número ("e agora?") não vira "há mais de 0 dias": vai a lista.
          if (dias > 0) return texto(falarSumidosHaMaisDe(dias, r.items.filter((i) => i.lateDays > dias).map((i) => i.name)))
          return texto(falarPrimeirosParaRecuperar(r.count, r.totalValueCents, r.items.map((i) => i.name)))
        }
        case 'estimativa_de_recuperacao':
          return texto(falarTotalParaRecuperar(r.count, r.totalValueCents))
        default:
          return texto(falarPrimeirosParaRecuperar(r.count, r.totalValueCents, r.items.map((i) => i.name)))
      }
    }
    case 'procuras_sem_horario': {
      const r = ler(z.array(z.object({ weekday: z.number().int().min(0).max(6), procuras: z.number().int() })), resultado)
      if (!r) return texto(FALHOU)
      const p = e?.periodo
      // No "abrir X", o nome do dia é sempre o dia da semana — inclusive "segunda", que o `entender`
      // só aceita com "feira" ou preposição (por causa de "segunda vez"). Medido no navegador: "e se eu
      // abrir segunda?" respondia sobre o domingo, o dia mais procurado — outra pergunta.
      const nomeNoTexto = /\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)\b/.exec(semAcento(ctx.texto))?.[1]
      const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
      const weekday = nomeNoTexto ? DIAS.indexOf(nomeNoTexto) : p?.tipo === 'dia' ? Temporal.PlainDate.from(p.data).dayOfWeek % 7 : null
      return texto(falarProcurasEmDiaFechado(weekday, r))
    }
    case 'simular_preco': {
      const r = ler(SimulacaoPreco, resultado)
      if (!r) {
        const p = ler(z.object({ status: z.string(), motivo: z.string().optional(), servico: z.string().optional() }), resultado)
        if (p?.status === 'nao_da' && p.motivo === 'preco_nao_fixo') {
          return texto(`${p.servico ?? 'Esse serviço'} não tem um preço fechado (é por hora, diária ou sob orçamento), então não há um preço para simular assim.`)
        }
        return texto(falarPreparo('simular_preco', resultado, ctx))
      }
      if (r.atendimentos === 0) return texto(`${r.servico} não teve atendimento concluído nos últimos ${r.dias} dias, então não há volume para simular.`)
      const s = simularPreco({ precoAtualCents: r.precoAtualCents, precoNovoCents: r.precoNovoCents, atendimentos: r.atendimentos })
      if (!s) return texto(`${reais(r.precoNovoCents)} já é o preço de hoje de ${r.servico}: não há o que simular.`)
      return texto(falarSimulacaoDePreco({ ...r, ...s }))
    }
    case 'simular_contratacao': {
      const r = ler(SimulacaoContratacao, resultado)
      if (!r) return texto(FALHOU)
      const s = simularContratacao(r)
      return texto(falarSimulacaoDeContratacao(s ? { custoMensalCents: r.custoMensalCents, ...s } : null, r.custoMensalCents))
    }
    case 'explicar_variacao': {
      const x = explicacao(resultado, ent)
      if (!x) return texto(FALHOU)
      // O que só o CICLO diz: se caiu no mês corrente, quem costuma voltar e ainda não voltou é a
      // primeira causa a olhar. Segundo passo só se este acesso puder ver a lista.
      if (x.caiuNoMesCorrente && ctx.disponiveis.has('clientes_para_recuperar')) return ferramenta('clientes_para_recuperar')
      return texto(x.texto)
    }
    case 'faturamento_do_periodo': {
      const r = ler(Caixa, resultado)
      if (!r) return texto(FALHOU)
      const aviso = e ? mesDoCaixa(e, ctx.hoje).aviso : ''
      if (foco === 'sobra_do_mes') {
        // Sem saber se a maquininha entrou, a frase não pode dizer que ela foi descontada.
        return texto(aviso + falarSobra(r.profitCents, rotuloDoMes(r.month, ctx.hoje, false), r.taxasRespondidas ?? false, r.custoFixoRespondido ?? false))
      }
      return texto(aviso + falarFaturamento(r.revenueCents, rotuloDoMes(r.month, ctx.hoje, true)))
    }
    case 'orcamentos_parados': {
      const r = ler(Orcamentos, resultado)
      if (!r) return texto(FALHOU)
      const base = falarOrcamentosSemResposta(r.map((o) => o.clientName))
      const maisAntigo = r[0]
      return texto(maisAntigo && maisAntigo.diasParado > 0 ? `${base} O mais antigo está parado há ${maisAntigo.diasParado === 1 ? '1 dia' : `${maisAntigo.diasParado} dias`}.` : base)
    }
    case 'alertas_de_estoque': {
      const r = ler(Estoque, resultado)
      if (!r) return texto(FALHOU)
      return texto(falarAlertasDeEstoque(r.map((i) => ({ nome: i.name, recomprar: i.precisaRecomprar, vencendo: i.validade === 'alerta', vencido: i.validade === 'bloqueado' }))))
    }
    case 'buscar_cliente': {
      const r = ler(Clientes, resultado)
      if (!r) return texto(FALHOU)
      const termo = typeof chamada.argumentos.termo === 'string' ? chamada.argumentos.termo : ''
      const res = resolverPorNome(termo, r.map((c) => ({ id: c.id, nome: c.name })))
      if (res.tipo === 'nenhum') return texto(`Não achei ninguém chamado "${termo}".`)
      if (res.tipo === 'ambiguo') return texto(falarQualDelas('pessoa', res.opcoes.map((o) => o.nome)))
      return seDisponivel(ctx, 'historico_do_cliente', { clientId: res.item.id })
    }
    case 'historico_do_cliente': {
      const r = ler(Historico, resultado)
      if (!r) return texto(FALHOU)
      const c = r.cliente
      if (foco === 'telefone') return texto(falarTelefone(c.name, c.phone_e164 ?? null))
      if (foco === 'quanto_deixou') return texto(falarQuantoDeixou(c.name, c.ltv_cents ?? 0, c.visits_count ?? 0))
      if (foco === 'costume') return texto(falarCostume(c.name, r.memoria ?? []))
      const agora = ctx.hoje
      const feitos = r.ultimosAgendamentos.filter((a) => a.status === 'done').map((a) => diaDe(a.starts_at, ctx.timezone))
      const ultimaData = c.last_visit_at ? diaDe(c.last_visit_at, ctx.timezone) : (feitos[0] ?? null)
      const futuro = r.ultimosAgendamentos
        .filter((a) => ['pending', 'confirmed'].includes(a.status) && Temporal.PlainDate.compare(diaDe(a.starts_at, ctx.timezone), agora) >= 0)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
      return texto(
        falarUltimaVisita({
          nome: c.name,
          ultima: ultimaData ? dataBr(ultimaData) : null,
          diasDesde: ultimaData ? ultimaData.until(agora, { largestUnit: 'days' }).days : null,
          proxima: futuro ? `${rotuloDoDia(diaDe(futuro.starts_at, ctx.timezone), agora)} às ${hora(futuro.starts_at, ctx.timezone)}` : null,
          visitas: c.visits_count ?? 0,
        }),
      )
    }
    default:
      if (chamada.nome.startsWith('preparar_')) return texto(falarPreparo(chamada.nome, resultado, ctx))
      return texto(FALHOU)
  }
}
