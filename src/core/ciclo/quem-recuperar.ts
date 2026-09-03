/**
 * Quem realmente aparece na tela "Recuperar receita".
 *
 * ## O defeito que isto conserta
 *
 * `client_cycles` guarda uma linha por **(cliente, serviço)** — é assim que a previsão funciona,
 * porque corte e progressiva voltam em ritmos diferentes. A tela, porém, promete outra coisa:
 * *"Clientes que o Motor de Ciclo identificou como atrasadas para voltar"*, e o cartão de resumo
 * é rotulado **"Clientes"**.
 *
 * Ela mostrava as linhas cruas. Medido nas seis contas de demonstração em 02/09:
 *
 * | conta            | linhas na tela | clientes distintos | clientes que DE FATO sumiram |
 * |------------------|---------------:|-------------------:|-----------------------------:|
 * | demo-studio-bella|            149 |                 52 |                            5 |
 * | demo-espaco-vitoria|          135 |                 44 |                            9 |
 * | demo-dom-estilo  |             53 |                 36 |                            3 |
 *
 * Um salão com 55 clientes lia **"Clientes: 149"**. E 72% a 92% das linhas eram de gente que
 * nunca deixou de vir — só experimentou um serviço uma vez, meses atrás. "Fulana — Platinado —
 * 240 dias atrasada" para quem corta o cabelo a cada três semanas.
 *
 * O diferencial declarado do produto é dizer QUEM chamar de volta. Enterrado em 97% de ruído, ele
 * deixa de dizer.
 *
 * ## As duas regras
 *
 * 1. **Uma linha por cliente.** Ninguém manda três mensagens para a mesma pessoa porque ela está
 *    atrasada em três serviços. Fica o serviço de MAIOR valor em risco, escolhido aqui pela
 *    comparação — e não pela ordem em que as linhas chegaram. A `v_recover_revenue` até vem
 *    ordenada por valor, mas depender disso é a mesma aposta de "paginar sem `.order()` explícito"
 *    que já mordeu esta base: ordem que não está escrita é ordem que um dia muda sem aviso, e a
 *    troca seria silenciosa (a lista continua do mesmo tamanho, só com o serviço errado em cada
 *    linha).
 *
 * 2. **Só quem não tem NENHUM ciclo em dia.** Cliente que vem todo mês cortar o cabelo não está
 *    "atrasada para voltar" — ela está ali. O fato de não fazer progressiva desde março é
 *    oportunidade de venda no salão, não motivo de campanha de recuperação. São coisas
 *    diferentes, e misturá-las é o que produziu o ruído.
 *
 * A soma de dinheiro segue as mesmas linhas: somar todos os serviços de todo mundo contava a
 * mesma pessoa várias vezes e inflava a promessa. Uma pessoa, um valor — o maior. Prometer menos
 * e entregar é melhor do que um número grande que não se sustenta.
 */

export type LinhaDeCiclo = {
  clientId: string
  valueCents: number
}

/**
 * `comCicloEmDia` são os ids de cliente que têm ao menos um ciclo `on_track` — a
 * `v_recover_revenue` não os expõe (ela filtra `on_track` fora), então quem chama busca à parte.
 */
export function quemRecuperar<T extends LinhaDeCiclo>(
  linhas: readonly T[],
  comCicloEmDia: ReadonlySet<string>,
): T[] {
  const melhorPorCliente = new Map<string, T>()

  for (const linha of linhas) {
    if (comCicloEmDia.has(linha.clientId)) continue
    const atual = melhorPorCliente.get(linha.clientId)
    if (!atual || linha.valueCents > atual.valueCents) melhorPorCliente.set(linha.clientId, linha)
  }

  // Ordem de saída explícita, pelo mesmo critério que a tela promete ("o que dá para recuperar"):
  // maior valor primeiro. Devolver na ordem do `Map` amarraria o resultado à ordem de chegada.
  return [...melhorPorCliente.values()].sort((a, b) => b.valueCents - a.valueCents)
}
