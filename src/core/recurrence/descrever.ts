import type { RegraRecorrencia } from './gerar-ocorrencias'

const DIAS_DA_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

/** "5" é a convenção de `RegraRecorrencia.ordinal` pra "a última do mês", exista ou não a 5ª. */
function ordinalPorExtenso(ordinal: number): string {
  return ordinal === 5 ? 'última' : `${ordinal}ª`
}

/**
 * Frase única em português pra qualquer padrão dos 3 tipos de `RegraRecorrencia` — a mesma
 * regra de negócio que gera as datas (`gerar-ocorrencias.ts`), só descrita em vez de calculada.
 * Pura, sem I/O: usada tanto pela tela de gestão de séries quanto por qualquer lugar futuro
 * que precise mostrar "o que essa série faz" sem repetir o `switch` na mão.
 *
 * Dia da semana sempre vem primeiro, seguido de uma cláusula fixa — nunca "Todo"/"Toda" antes
 * do dia (regra de copy sem concordância, docs/09-PLATAFORMA.md §3.2/P1: "sábado"/"domingo"
 * são masculinos e as demais são femininas via "-feira", então qualquer artigo antes do dia
 * exigiria concordância de gênero que quebraria pra metade dos dias).
 */
export function descreverRegra(regra: RegraRecorrencia): string {
  switch (regra.tipo) {
    case 'semanal':
      return regra.intervaloSemanas === 1
        ? `${DIAS_DA_SEMANA[regra.weekday]}, toda semana`
        : `${DIAS_DA_SEMANA[regra.weekday]}, a cada ${regra.intervaloSemanas} semanas`
    case 'a_cada_dias':
      return `A cada ${regra.intervaloDias} dias`
    case 'mensal_dia_semana':
      return `${DIAS_DA_SEMANA[regra.weekday]}, ${ordinalPorExtenso(regra.ordinal)} do mês`
  }
}
