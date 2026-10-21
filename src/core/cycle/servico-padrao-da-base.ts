/**
 * Qual serviço vem escolhido quando a pessoa traz a clientela ("Quem você já atende" e a importação)
 * — `docs/82` §7.
 *
 * O ritmo desse serviço é o que o Motor usa para dizer quem da base trazida já passou da hora, e o
 * preço dele é o R$ de "Dá para recuperar" e o nome dele vai na mensagem de "Chamar". Até
 * 2026-09-23 vinha o PRIMEIRO da lista, e a lista empata em `position` (o pacote nasce todo com 0)
 * e desempata por nome — então o padrão era uma questão de alfabeto. Numa barbearia nova saía
 * "Barba · 14 dias": o ciclo mais curto do pacote, um número inflado justo no momento em que o dono
 * decide se confia no produto.
 *
 * A regra:
 *   1. com histórico, o serviço **mais atendido** — é o ritmo da maior parte da clientela;
 *   2. sem histórico, o **serviço de volta** do pacote da profissão (`SERVICO_DE_VOLTA`), quando a
 *      conta ainda tem ele;
 *   3. sem nenhum dos dois, o de **ritmo mediano** — errar para o meio erra menos para os dois lados
 *      do que o mais curto (infla o atraso) ou o mais longo (esconde quem sumiu). Empate de ritmo
 *      fica com o primeiro na ordem da lista, a mesma que a pessoa vê.
 *
 * O passo 2 existe porque a mediana sozinha acertava a barbearia e errava os outros nichos do alvo
 * (`docs/108-norte`), medido no teste de 10 minutos de 16/10/2026: cílios saía "Aplicação clássica"
 * (R$ 150, a primeira vez da cliente, não a volta), sobrancelha "Retoque de micro" (R$ 200, 30 dias)
 * e unhas "Banho de gel". A fila nascia com o preço errado e a mensagem dizia "seu último horário de
 * aplicação clássica" para quem faz manutenção.
 */

export type ServicoCandidato = { id: string; cycleDays: number; atendimentos: number; canonicalKey?: string | null }

/**
 * O serviço que a clientela de cada pacote REPETE: a manutenção, não a aplicação; o design simples,
 * não a micropigmentação. Pela `canonical_key` (`0097`), que não muda quando o dono renomeia. Pacote
 * fora da lista cai na mediana: melhor errar para o meio do que inventar o principal de um nicho que
 * ninguém mediu.
 */
export const SERVICO_DE_VOLTA: ReadonlySet<string> = new Set([
  'pack:barber:Corte',
  'pack:lashes:Manutenção volume russo',
  'pack:brows:Design simples',
  // docs/112 EXP-S06 (0146): pé e mão é o par mais vendido e abre o pacote de unhas; manicure simples
  // fica para as contas criadas antes, que não têm o item novo.
  'pack:nails:Pé e mão',
  'pack:nails:Manicure simples',
])

export function servicoPadraoDaBase(servicos: readonly ServicoCandidato[]): string | null {
  if (servicos.length === 0) return null

  const maisAtendido = servicos.reduce((melhor, s) => (s.atendimentos > melhor.atendimentos ? s : melhor))
  if (maisAtendido.atendimentos > 0) return maisAtendido.id

  const deVolta = servicos.find((s) => s.canonicalKey != null && SERVICO_DE_VOLTA.has(s.canonicalKey))
  if (deVolta) return deVolta.id

  const ritmos = servicos.map((s) => s.cycleDays).sort((a, b) => a - b)
  const mediana = ritmos[Math.floor((ritmos.length - 1) / 2)]
  return servicos.find((s) => s.cycleDays === mediana)?.id ?? servicos[0]?.id ?? null
}
