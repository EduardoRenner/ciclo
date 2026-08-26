/**
 * A costura entre o AGENDADOR e a ROTA — e por que ela precisa de folga.
 *
 * Cada rota de cron age só no tenant que está passando por uma hora específica no PRÓPRIO fuso
 * (3h para o Motor de Ciclo, 4h para segmentos). Esse desenho nasceu para o cron do Vercel, que
 * dispararia a cada 15 minutos: acertar "hora local == 3" era garantido, porque quatro disparos
 * seguidos caíam dentro da mesma hora.
 *
 * Com o agendamento no GitHub Actions (`docs/18` §L.5) existe UM disparo por janela, e o próprio
 * GitHub documenta `schedule` como best-effort: atrasa sob carga e pode pular execução.
 *
 * Medido em 2026-08-25, no único disparo agendado que já existiu: pedido para 06:10 UTC,
 * aconteceu às 07:06 — 56 minutos de atraso. Como os 11 tenants da base são UTC-3, 06:10 UTC
 * seria 03:10 local (dentro), e 07:06 virou 04:06 local (fora). O Motor de Ciclo processou ZERO
 * tenants, devolveu 200, e o job ficou verde. Ver `docs/23` §2.
 *
 * A saída é afrouxar a igualdade para uma janela, e ela é barata por um motivo já escrito no
 * cabeçalho da própria rota desde o TICKET-036: reprocessar o mesmo tenant no mesmo dia é
 * inofensivo (upsert por PK). **A checagem de hora é economia de processamento, não corretude.**
 * Então trocar exatidão por folga não custa nada que importe — custa algumas passadas a mais.
 */

/**
 * Quantas horas locais depois do alvo a rota ainda aceita trabalhar.
 *
 * Três é o que faz cada fuso do Brasil continuar coberto mesmo com DUAS horas de atraso do
 * agendador, com o schedule de cinco horários de `cron.yml` — e ainda deixa pelo menos dois
 * disparos elegíveis por tenant, de modo que uma execução pulada não zera o dia.
 * `tests/unit/server/cron-sobrevive-a-atraso.test.ts` recalcula essas duas garantias a cada
 * build, para os quatro fusos, em vez de confiar neste comentário.
 *
 * Não aumente sem olhar o teste: janela larga demais faz a rota trabalhar à toa em todo disparo,
 * e janela que passe de 24 atravessa a virada do dia local, o que muda a data usada no cálculo.
 */
export const TOLERANCIA_HORAS = 3

/**
 * A hora local do tenant, de 0 a 23. `hourCycle: 'h23'` importa: sem ele, meia-noite volta como
 * "24" em algumas combinações de locale e a comparação com o alvo erra silenciosamente.
 */
export function horaLocalDe(timezone: string, agora: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(agora))
}

/** A data local do tenant em `YYYY-MM-DD`. `en-CA` é o atalho de locale que já dá esse formato. */
export function dataLocalDe(timezone: string, agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(agora)
}

/**
 * A hora local está dentro da janela que começa no alvo?
 *
 * A distância é calculada em aritmética modular para que uma janela que atravesse a meia-noite
 * (alvo 23, tolerância 3 → 23, 0, 1) continue certa. Hoje nenhuma rota usa alvo assim, mas a
 * alternativa é uma comparação que funciona por acidente até alguém mudar um número.
 */
export function dentroDaJanela(horaLocal: number, alvo: number, tolerancia: number = TOLERANCIA_HORAS): boolean {
  const distancia = ((horaLocal - alvo) % 24 + 24) % 24
  return distancia < tolerancia
}
