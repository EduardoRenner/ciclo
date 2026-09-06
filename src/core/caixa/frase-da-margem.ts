/**
 * A frase que a lista de serviços mostra sob a margem — `docs/50` L-06, critério 2.
 *
 * A regra que ela existe para cumprir: **nomear a alavanca sem puxá-la.** *"A comissão leva 60%
 * deste serviço"* é observação; *"suba o preço para R$ 95"* é precificação automática, vetada pelo
 * `CLAUDE.md`. A diferença não é de tom — é de quem decide.
 *
 * Mora em `core/` e não solta no JSX porque a fronteira entre as duas é justamente o que precisa
 * ficar guardado por teste: uma frase escrita direto na tela vira "sugestão" na primeira vez que
 * alguém quiser deixá-la mais útil.
 */

import type { MargemDoServico, ParcelaDominante } from '@/core/caixa/margem-do-servico'

const NOME_DA_PARCELA: Record<ParcelaDominante, string> = {
  comissao: 'A comissão',
  material: 'O produto',
  taxa: 'A taxa da maquininha',
}

export function fraseDaMargem(margem: MargemDoServico): string | null {
  if (margem.parcelaDominante === null) return null

  const valorCents =
    margem.parcelaDominante === 'comissao'
      ? margem.comissaoCents
      : margem.parcelaDominante === 'material'
        ? margem.materialCents
        : margem.taxaCents

  /*
   * Percentual da RECEITA, e não da margem. "A comissão leva 180% do que sobra" é aritmeticamente
   * certo num serviço no vermelho e não ajuda ninguém a decidir nada — o dono precisa da fatia do
   * bolo, não da fatia do que sobrou do bolo.
   */
  const fatiaBps = margem.receitaCents > 0 ? Math.round((valorCents / margem.receitaCents) * 10_000) : 0

  return `${NOME_DA_PARCELA[margem.parcelaDominante]} leva ${Math.round(fatiaBps / 100)}% do que este serviço fatura.`
}
