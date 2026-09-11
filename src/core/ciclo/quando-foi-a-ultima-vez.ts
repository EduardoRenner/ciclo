import { Temporal } from '@js-temporal/polyfill'

/**
 * "Quando foi a última vez que você atendeu essa pessoa?" — respondido de memória, em linguagem de
 * gente, sem calendário.
 *
 * ## Por que aproximar é suficiente, e isto não é preguiça
 *
 * Medido em `core/cycle/compute.ts`: com **um só ponto de histórico**, `gaps` fica vazio, então
 * `personalCycleDays = defaultCycleDays` e o estado sai de `hoje − (última visita + ciclo)`. A data
 * exata não muda o ritmo estimado; ela só desloca a régua.
 *
 * Sendo preciso, porque a primeira versão desta frase era forte demais e um teste a desmentiu:
 * errar alguns dias **pode** mover o rótulo entre `due` e `late` (o corte fica em `lateDays <= 0`).
 * O que ele não move é a **lista**: `v_clientes_a_recuperar` conta tudo que não é `on_track`, e a
 * única fronteira do `on_track` está três dias antes da volta prevista. Para a pergunta que a tela
 * "Hoje" faz — *quem já passou da hora de voltar* — "uns 15 dias" carrega a mesma informação que
 * "12 de agosto". O que mudaria a resposta é errar de DEGRAU, e os degraus estão a semanas um do
 * outro.
 *
 * É o que torna esta tela possível. A profissional que não tem planilha tem a base na cabeça, e a
 * memória dela é aproximada por natureza: ninguém lembra a data, todo mundo lembra "faz umas duas
 * semanas". Pedir precisão que não muda o resultado é pedir para a pessoa desistir.
 *
 * ## A escada
 *
 * Os degraus são frases que se ouvem num salão, não faixas de tempo bem-comportadas. O último
 * ("faz tempo") é de propósito vago e generoso: quem cai nele já está perdido para qualquer ciclo,
 * e forçar a pessoa a escolher entre "4 meses" e "6 meses" não muda nada que a tela vá mostrar.
 */
export const QUANDO_FOI = [
  { valor: 'semana', rotulo: 'Semana passada', dias: 7 },
  { valor: 'quinzena', rotulo: 'Uns 15 dias', dias: 15 },
  { valor: 'mes', rotulo: 'Um mês', dias: 30 },
  { valor: 'dois-meses', rotulo: 'Uns 2 meses', dias: 60 },
  { valor: 'faz-tempo', rotulo: 'Faz tempo', dias: 120 },
] as const

export type QuandoFoi = (typeof QUANDO_FOI)[number]['valor']

export const VALORES_DE_QUANDO = QUANDO_FOI.map((q) => q.valor) as readonly QuandoFoi[]

/**
 * Dias atrás que o degrau representa. Lança para valor desconhecido em vez de cair num padrão:
 * um `?? 30` silencioso transformaria um bug de digitação numa data plausível, e ninguém veria.
 */
export function diasDesde(valor: QuandoFoi): number {
  const degrau = QUANDO_FOI.find((q) => q.valor === valor)
  if (!degrau) throw new Error(`degrau de tempo desconhecido: ${valor}`)
  return degrau.dias
}

/**
 * A data que vai para `clients.last_visit_at` e para o ciclo.
 *
 * `hoje` entra por parâmetro porque data de "agora" dentro de função pura é o que faz teste passar
 * hoje e falhar em janeiro — a regra vale em toda a casa.
 */
export function dataDaUltimaVez(valor: QuandoFoi, hoje: Temporal.PlainDate): Temporal.PlainDate {
  return hoje.subtract({ days: diasDesde(valor) })
}
