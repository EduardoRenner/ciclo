/**
 * Quantos pontos um atendimento vale. Multiplica ANTES de dividir, e a ordem é o conserto.
 *
 * Era `Math.floor((priceCents / 100) * pointsPerReal)`, dentro de `creditarPontos`. `priceCents /
 * 100` quase nunca tem representação binária exata — o produto cai um fio ABAIXO do inteiro e o
 * `floor` derruba um ponto inteiro. Multiplicando primeiro, `priceCents * pointsPerReal` é inteiro
 * exato e a divisão por 100 arredonda uma vez só, na direção declarada.
 *
 * ## A medição, incluindo a que me enganou
 *
 * A primeira varredura usou `pointsPerReal` em {1, 2, 3, 5, 10} e deu **zero divergências** — eu
 * quase registrei "sem defeito, nada a fazer". O esquema aceita `int` de 0 a 100
 * (`EsquemaConfigFidelidade`), e varrendo a faixa inteira até R$ 3.000 aparecem **48.088** casos.
 *
 * Na faixa de preço real de um salão (R$ 30–R$ 200), os valores afetados são **12 de 100**: 15, 25,
 * 30, 45, 50, 55, 60, 75, 85, 90, 95 e 100 — justamente os números redondos que alguém escolhe ao
 * montar um programa mais generoso. O padrão é 1, que é seguro: latente para a maioria dos tenants,
 * vivo para quem configurou.
 *
 * ## A direção
 *
 * **Sempre um ponto A MENOS.** O erro é todo contra o cliente, e num serviço de preço fixo ele se
 * repete a cada visita, para sempre, sem nada denunciar — o extrato mostra o número errado e ele é
 * plausível. `core/pricing/sinal.ts` já usava a ordem certa para o sinal em basis points; era a
 * fidelidade que estava fora do padrão da casa.
 */
export function pontosPorGasto(priceCents: number, pointsPerReal: number): number {
  if (pointsPerReal <= 0 || priceCents <= 0) return 0
  return Math.floor((priceCents * pointsPerReal) / 100)
}
