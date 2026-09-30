import { Temporal } from '@js-temporal/polyfill'

import { reais } from '@/core/inteligencia/falar'

/**
 * `docs/84` Aposta C (P3): o dono liga um teste — "vou abrir a quinta à noite por 14 dias" — e o
 * CICLO compara o que aconteceu DURANTE com os mesmos N dias de ANTES.
 *
 * ## O que a leitura promete, e o que não
 *
 * O `docs/84` §7.3 já fez a crítica: 14 dias não separam o efeito do teste da semana de pagamento
 * ou de um feriado. Então:
 *
 * - nada de veredito enquanto o teste roda — só a contagem até ali, com o antes ao lado;
 * - "subiu"/"caiu" só com movimento bastante nos dois períodos (`MINIMO_PARA_LER`) e diferença que
 *   não seja miúda (`DIFERENCA_QUE_CONTA`); abaixo disso a frase diz que ficou parecido, ou que é
 *   pouco movimento para ler;
 * - a amostra vai SEMPRE junto ("14 dias, 110 atendimentos"), e a palavra é "indicativo", nunca
 *   "comprovado";
 * - número de dinheiro é "atendido" (preço de tabela dos concluídos), a mesma palavra da tela Hoje —
 *   não é faturamento.
 *
 * Com dia da semana escolhido, as duas janelas contam só aquele dia: "abri a quinta" se mede nas
 * quintas, e as outras seis diluiriam o efeito até sumir.
 */

export const METRICAS = ['atendimentos', 'atendido_cents'] as const
export type Metrica = (typeof METRICAS)[number]

export const DIAS_MINIMO = 7
export const DIAS_MAXIMO = 60

/** Abaixo disto, somando antes e durante, a diferença descreve o acaso. */
export const MINIMO_PARA_LER = 20
/** Menos que isto de diferença é "ficou parecido": a variação normal de uma semana para outra. */
export const DIFERENCA_QUE_CONTA = 0.1

export type Janela = { de: string; ate: string }
export type Contagem = { atendimentos: number; atendidoCents: number }

/** Os N dias de antes terminam na véspera do início; os N dias de teste começam no início. */
export function janelasDoExperimento(startsOn: string, dias: number): { antes: Janela; durante: Janela } {
  const inicio = Temporal.PlainDate.from(startsOn)
  return {
    antes: { de: inicio.subtract({ days: dias }).toString(), ate: inicio.subtract({ days: 1 }).toString() },
    durante: { de: startsOn, ate: inicio.add({ days: dias - 1 }).toString() },
  }
}

/** `weekday`: 0 = domingo … 6 = sábado (convenção de `business_hours`). */
function diaDaSemana(dia: string): number {
  return Temporal.PlainDate.from(dia).dayOfWeek % 7
}

/** Atendimentos concluídos, cada um com o DIA já no fuso do salão. */
export function contarNaJanela(
  concluidos: ReadonlyArray<{ dia: string; priceCents: number }>,
  janela: Janela,
  weekday: number | null,
): Contagem {
  let atendimentos = 0
  let atendidoCents = 0
  for (const a of concluidos) {
    if (a.dia < janela.de || a.dia > janela.ate) continue
    if (weekday !== null && diaDaSemana(a.dia) !== weekday) continue
    atendimentos++
    atendidoCents += a.priceCents
  }
  return { atendimentos, atendidoCents }
}

/** Quantas vezes o dia da semana escolhido cai na janela (ou quantos dias, sem dia escolhido). */
export function diasNaJanela(janela: Janela, weekday: number | null): number {
  const de = Temporal.PlainDate.from(janela.de)
  const total = de.until(Temporal.PlainDate.from(janela.ate), { largestUnit: 'days' }).days + 1
  if (weekday === null) return total
  let n = 0
  for (let i = 0; i < total; i++) if (de.add({ days: i }).dayOfWeek % 7 === weekday) n++
  return n
}

const NOME_DO_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const
const PLURAL_DO_DIA = ['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados'] as const

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`

function nAtendimentos(n: number): string {
  return n === 1 ? '1 atendimento' : `${n} atendimentos`
}

/** "Nos 14 dias", "Nas 2 quintas", "No sábado": sábado e domingo são masculinos, os outros não. */
function noPeriodo(quantos: number, weekday: number | null): string {
  const masculino = weekday === null || weekday === 0 || weekday === 6
  if (quantos === 1 && weekday !== null) return `${masculino ? 'No' : 'Na'} ${NOME_DO_DIA[weekday]}`
  return `${masculino ? 'Nos' : 'Nas'} ${periodo(quantos, weekday)}`
}

function periodo(quantos: number, weekday: number | null): string {
  if (weekday === null) return quantos === 1 ? '1 dia' : `${quantos} dias`
  return quantos === 1 ? `1 ${NOME_DO_DIA[weekday]}` : `${quantos} ${PLURAL_DO_DIA[weekday]}`
}

export type EntradaDaLeitura = {
  startsOn: string
  dias: number
  metrica: Metrica
  weekday: number | null
  /** O antes CONGELADO na criação. */
  antes: Contagem
  /** Atendimentos concluídos do período de teste, dia já no fuso do salão. */
  concluidos: ReadonlyArray<{ dia: string; priceCents: number }>
  /** Hoje, no fuso do salão. */
  hoje: string
  cancelado: boolean
}

export type Leitura = {
  estado: 'agendado' | 'rodando' | 'concluido' | 'cancelado'
  /** Dias do teste já fechados (hoje não conta: ainda pode ter atendimento). */
  diasCorridos: number
  antes: Contagem
  durante: Contagem
  /** A frase principal — o que o dono lê. */
  frase: string
  /** "Indicativo: 4 quintas, 23 atendimentos." — sempre que há o que medir. */
  amostra: string | null
}

export function lerExperimento(e: EntradaDaLeitura): Leitura {
  const { antes: jAntes, durante: jDurante } = janelasDoExperimento(e.startsOn, e.dias)
  const valor = (c: Contagem) => (e.metrica === 'atendimentos' ? c.atendimentos : c.atendidoCents)
  const fmt = (n: number) => (e.metrica === 'atendimentos' ? nAtendimentos(n) : reais(n))

  if (e.cancelado) {
    return { estado: 'cancelado', diasCorridos: 0, antes: e.antes, durante: { atendimentos: 0, atendidoCents: 0 }, frase: 'Teste cancelado.', amostra: null }
  }
  if (e.hoje < jDurante.de) {
    return {
      estado: 'agendado',
      diasCorridos: 0,
      antes: e.antes,
      durante: { atendimentos: 0, atendidoCents: 0 },
      frase: `Começa em ${ddmm(jDurante.de)}. O antes já está guardado: ${fmt(valor(e.antes))} em ${periodo(diasNaJanela(jAntes, e.weekday), e.weekday)}.`,
      amostra: null,
    }
  }

  const concluido = e.hoje > jDurante.ate
  // Enquanto roda, só os dias JÁ FECHADOS contam — o de hoje ainda pode ganhar atendimento.
  const ateOnde: Janela = concluido ? jDurante : { de: jDurante.de, ate: Temporal.PlainDate.from(e.hoje).subtract({ days: 1 }).toString() }
  const durante = ateOnde.ate < ateOnde.de ? { atendimentos: 0, atendidoCents: 0 } : contarNaJanela(e.concluidos, ateOnde, e.weekday)
  const diasCorridos = ateOnde.ate < ateOnde.de ? 0 : diasNaJanela({ de: ateOnde.de, ate: ateOnde.ate }, null)
  const qAntes = diasNaJanela(jAntes, e.weekday)

  if (!concluido) {
    return {
      estado: 'rodando',
      diasCorridos,
      antes: e.antes,
      durante,
      frase: `Em andamento: ${diasCorridos} de ${e.dias} dias. Até agora, ${fmt(valor(durante))}; ${noPeriodo(qAntes, e.weekday).toLowerCase()} antes do teste, ${fmt(valor(e.antes))}. O resultado sai quando o teste acabar.`,
      amostra: null,
    }
  }

  const a = valor(e.antes)
  const d = valor(durante)
  const nDurante = periodo(diasNaJanela(jDurante, e.weekday), e.weekday)
  const movimento = e.antes.atendimentos + durante.atendimentos
  const amostra = `Indicativo: ${nDurante} de teste, ${nAtendimentos(movimento)} somando os dois períodos.`
  const base = `Durante o teste: ${fmt(d)} em ${nDurante}. ${noPeriodo(qAntes, e.weekday)} antes: ${fmt(a)}.`

  let leitura: string
  if (movimento < MINIMO_PARA_LER) leitura = 'É pouco movimento para ler diferença: pode ser acaso.'
  else if (a === 0) leitura = d > 0 ? 'Antes não havia nenhum; o teste trouxe movimento onde não tinha.' : 'Nenhum movimento nos dois períodos.'
  else {
    const variacao = (d - a) / a
    const pct = Math.round(Math.abs(variacao) * 100)
    if (Math.abs(variacao) < DIFERENCA_QUE_CONTA) leitura = `Ficou parecido (${pct}% de diferença).`
    else leitura = `${variacao > 0 ? 'Subiu' : 'Caiu'} ${pct}%. É um teste prático, não uma prova: semana de pagamento e feriado também mexem nesse número.`
  }

  return { estado: 'concluido', diasCorridos, antes: e.antes, durante, frase: `${base} ${leitura}`, amostra }
}
