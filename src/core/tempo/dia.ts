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
