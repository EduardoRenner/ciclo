/**
 * O dia do calendario num fuso, como `AAAA-MM-DD`.
 *
 * Existe porque `new Date().toISOString().slice(0, 10)` e "hoje em UTC", nao hoje no salao. Em
 * Brasilia (UTC-3) isso devolve o dia SEGUINTE das 21h a meia-noite — e o projeto ja pagou por
 * isso: `src/app/admin/agenda/page.tsx` tem o comentario do conserto ("o dono fechava a barbearia
 * as 21h30, abria a agenda e via amanha. Tres horas erradas por noite, todas as noites").
 *
 * `Intl.DateTimeFormat('en-CA')` devolve exatamente `AAAA-MM-DD`, e respeita `timeZone` — nenhuma
 * conta de fuso a mao, que e onde este tipo de defeito nasce.
 *
 * Mora em `core/` porque e regra pura sem I/O (regra 5 do CLAUDE.md). Estava dentro de
 * `server/assistente/ferramentas.ts`, onde so o assistente alcancava.
 */
export function diaNoFuso(timezone: string, quando: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(quando)
}

/**
 * O dia da semana no fuso do salão — `0` domingo … `6` sábado, a mesma convenção de
 * `business_hours.weekday` e de `weekdayPg` em `core/recurrence/gerar-ocorrencias.ts`.
 *
 * Existe pelo defeito que o docstring acima já descreve, encontrado de novo em outro lugar:
 * `lista-espera.ts` casava a preferência de dia da pessoa com `new Date(startsAt).getUTCDay()`.
 * Das 21h à meia-noite em Brasília isso devolve o dia SEGUINTE — medido: uma vaga de **segunda
 * 21:00** era lida como terça, e uma de **sábado 22:00** como domingo.
 *
 * O efeito não é cosmético, é a decisão errando de pessoa: quem pediu "só segundas" não recebia a
 * vaga de segunda à noite, e quem pediu "só terças" recebia. Duas linhas acima, no mesmo arquivo,
 * `periodoDoHorario` já fazia certo com `timeZone` — o erro era só nesta regra.
 *
 * O comentário que estava lá dizia "aproximação; refinar se DST virar problema". O problema nunca
 * foi horário de verão: o Brasil não tem desde 2019, então essa condição nunca chegaria. É o
 * deslocamento fixo de -3, que vale todo dia do ano.
 */
export function diaDaSemanaNoFuso(timezone: string, quando: Date): number {
  /*
   * `en-US` com `weekday: 'short'` devolve nome, não número — e mapear nome por idioma é frágil.
   * Compor a partir de `diaNoFuso` mantém uma fonte só para "que dia é lá" e deixa o cálculo do
   * dia da semana com o `Date`, já sem fuso envolvido: a data ali é o dia do calendário do salão,
   * e `T12:00:00Z` fica longe das duas bordas em qualquer fuso do Brasil.
   */
  return new Date(`${diaNoFuso(timezone, quando)}T12:00:00Z`).getUTCDay()
}

/**
 * O dia daqui a `dias` dias, no fuso indicado.
 *
 * Soma em MILISSEGUNDOS sobre o instante e so entao formata no fuso — nao soma no calendario. Para
 * "validade de 7 dias" isso e o certo: o que a pessoa combinou foi uma duracao. Somar no calendario
 * exigiria decidir o que fazer no dia de mudanca de horario de verao, e o produto nao precisa dessa
 * decisao aqui.
 */
export function diaDaquiA(timezone: string, dias: number, quando: Date = new Date()): string {
  return diaNoFuso(timezone, new Date(quando.getTime() + dias * 86_400_000))
}

/**
 * Quantos dias (inteiros, nunca negativo) se passaram desde um instante `timestamptz`. Usado
 * pelo banner "faz N dias" de `reconhecimento.ts` — `Math.floor`, não arredondado, porque "faz 24
 * dias" tem que bater com o que `personal_cycle_days` mediu, não com uma aproximação para cima.
 */
export function diasDesde(isoAntigo: string, agora: Date = new Date()): number {
  return Math.max(0, Math.floor((agora.getTime() - new Date(isoAntigo).getTime()) / 86_400_000))
}
