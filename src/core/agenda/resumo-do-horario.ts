/**
 * O dia por extenso de um horário, no fuso do negócio, tirado do PRÓPRIO horário.
 *
 * A página pública montava o resumo com o `dia` selecionado na tela e a hora com o `startsAt` do
 * horário escolhido. Quando uma resposta antiga de horários chegava depois da nova, a lista era de
 * outro dia: a tela dizia "quinta, 15 às 09:00" e o banco gravava terça 13 às 09:00 (APR-003,
 * achado F-01). Tirar dia e hora do mesmo instante faz o resumo nunca discordar do que é gravado.
 */
export function diaPorExtensoNoFuso(instanteIso: string, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(instanteIso))
}
