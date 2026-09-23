/**
 * Qual serviço vem escolhido na tela "Quem você já atende" — `docs/82` §7.
 *
 * O ritmo desse serviço é o que o Motor usa para dizer quem da base trazida já passou da hora. Até
 * 2026-09-23 vinha o PRIMEIRO da lista, e a lista empata em `position` (o pacote nasce todo com 0)
 * e desempata por nome — então o padrão era uma questão de alfabeto. Numa barbearia nova saía
 * "Barba · 14 dias": o ciclo mais curto do pacote. Quem não trocasse (e na primeira tela ninguém
 * troca) via o Motor marcar como atrasada gente que ainda estava no ritmo de corte — um número
 * inflado justo no momento em que o dono decide se confia no produto.
 *
 * A regra agora tem motivo:
 *   1. com histórico, o serviço **mais atendido** — é o ritmo da maior parte da clientela;
 *   2. sem histórico (conta nova), o de **ritmo mediano** — errar para o meio erra menos para os
 *      dois lados do que o mais curto (infla o atraso) ou o mais longo (esconde quem sumiu).
 *      Empate de ritmo fica com o primeiro na ordem da lista, a mesma que a pessoa vê.
 */

export type ServicoCandidato = { id: string; cycleDays: number; atendimentos: number }

export function servicoPadraoDaBase(servicos: readonly ServicoCandidato[]): string | null {
  if (servicos.length === 0) return null

  const maisAtendido = servicos.reduce((melhor, s) => (s.atendimentos > melhor.atendimentos ? s : melhor))
  if (maisAtendido.atendimentos > 0) return maisAtendido.id

  const ritmos = servicos.map((s) => s.cycleDays).sort((a, b) => a - b)
  const mediana = ritmos[Math.floor((ritmos.length - 1) / 2)]
  return servicos.find((s) => s.cycleDays === mediana)?.id ?? servicos[0]?.id ?? null
}
