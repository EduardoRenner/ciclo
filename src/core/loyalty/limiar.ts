/**
 * A partir de quantos pontos uma cliente conta como "perto do prêmio" no resumo proativo da tela
 * "Hoje" (`centralDeAcoes`, `server/services/crm.ts`).
 *
 * Mora em `core/` porque é regra de negócio pura, sem I/O (regra 5 do `CLAUDE.md`) — e porque a
 * primeira versão da guarda desta regra **espelhava a fórmula dentro do próprio teste** em vez de
 * exercitar o código do produto. Ela passava verde com o defeito reintroduzido: provava que
 * `0,8 × prêmio` é proporcional, não que o produto usa isso. Guarda cega, a mesma classe que o
 * `CLAUDE.md` descreve e que já apareceu duas vezes nesta base. Com a regra exportada daqui, o
 * teste chama a MESMA função que a tela chama, e a mutação passa a reprovar.
 *
 * O defeito que originou tudo: o limiar era `>= 80` cravado, enquanto `rewardThreshold` é escolha
 * do dono (1 a 100.000, padrão 100). No padrão a conta fechava por coincidência — 80 é 80% de 100
 * — e por isso sobreviveu. Fora dele mentia nas duas direções, e a pior é a segunda:
 *   • prêmio 500 → anunciava "perto do prêmio" com 16% do caminho andado;
 *   • prêmio 50  → quem estava DE FATO perto (40 pontos, 80%) nunca aparecia, porque 40 < 80.
 *     O resumo proativo ficava cego justamente para quem ele existe para pegar.
 */

/** 0,8 preserva o comportamento anterior no prêmio padrão (100 → 80), que era o número cravado. */
export const FRACAO_PERTO_DO_PREMIO = 0.8

export function limiarPertoDoPremio(rewardThreshold: number): number {
  return Math.ceil(FRACAO_PERTO_DO_PREMIO * rewardThreshold)
}
