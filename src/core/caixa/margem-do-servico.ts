/**
 * `docs/50` L-06 — a razão ao lado do número.
 *
 * "Sobrou R$ 21,40" responde *quanto*. Não responde *por quê*, e sem o porquê o número não vira
 * decisão: o dono olha uma margem baixa e não sabe se o problema é a comissão, o produto ou a
 * maquininha. A pesquisa (`docs/47` P02) mede que 73% dos donos não sabem calcular o custo de um
 * serviço — quem não sabe montar a conta também não sabe lê-la de trás para frente.
 *
 * ## De onde sai cada parcela, e por que não é uma segunda fonte
 *
 * `tickets.profit_cents` é `(subtotal − desconto) − material − taxa − comissão`, congelado no
 * fechamento. Aqui a mesma conta é feita um grão abaixo, com as MESMAS colunas congeladas:
 *
 * | Parcela | De onde |
 * |---|---|
 * | receita | `ticket_items.total_cents`, que já traz o desconto do item |
 * | material | `ticket_items.cost_cents` — exato, congelado no lançamento |
 * | comissão | `ticket_items.commission_cents` — exato, congelado no fechamento |
 * | desconto da comanda | rateado por peso de receita |
 * | taxa da maquininha | rateado por peso de receita |
 *
 * As duas últimas são da comanda inteira e não têm como ser exatas por serviço — mas o rateio é o
 * mesmo de `ratearLucroDaComanda`, e a soma das partes reconstrói o `profit_cents` do fechamento.
 * Isso é o que separa "o mesmo dado num grão mais fino" de "um segundo total que não bate com a
 * tela do lado", que é a armadilha que esta base já pagou no livro-caixa.
 */

import { ratearLucroDaComanda } from '@/core/caixa/concentracao'

export type ItemFechado = {
  /** `null` em item de produto avulso: ele não tem margem DE SERVIÇO para entrar aqui. */
  serviceId: string | null
  totalCents: number
  costCents: number
  commissionCents: number
}

export type ComandaFechada = {
  itens: readonly ItemFechado[]
  discountCents: number
  feeCents: number
}

export type ParcelaDominante = 'comissao' | 'material' | 'taxa'

export type MargemDoServico = {
  serviceId: string
  /** Quantas comandas fechadas tocaram este serviço. É o que sustenta (ou não) o número. */
  atendimentos: number
  receitaCents: number
  comissaoCents: number
  materialCents: number
  taxaCents: number
  lucroCents: number
  /** Participação do lucro na receita, em basis points. */
  margemBps: number
  /**
   * A parcela que mais come, e SÓ quando a margem está abaixo do piso. Acima dele o serviço está
   * saudável e apontar um "vilão" seria fabricar um problema — a tela ganharia um alarme por
   * serviço, todo dia, e alarme que sempre toca deixa de ser lido.
   */
  parcelaDominante: ParcelaDominante | null
}

/**
 * Abaixo de um terço de sobra, vale dizer quem está comendo o resto.
 *
 * O número é um limiar de ATENÇÃO, não uma meta: o CICLO não sabe qual margem é boa para aquele
 * salão, e fingir que sabe seria o primo do preço sugerido, que o `CLAUDE.md` veta. Ele existe
 * só para decidir quando a tela fala e quando ela cala.
 */
export const PISO_DE_MARGEM_BPS = 3_000

/**
 * Menos que isto e o número não se sustenta: uma coloração com desconto de amiga, sozinha,
 * viraria "este serviço dá 4% de margem" para sempre. É o mesmo piso de honestidade que a ficha do
 * cliente usa antes de projetar lucro anual.
 */
export const MINIMO_DE_ATENDIMENTOS = 3

type Acumulado = {
  atendimentos: number
  receitaCents: number
  comissaoCents: number
  materialCents: number
  taxaCents: number
  descontoCents: number
}

function vazio(): Acumulado {
  return { atendimentos: 0, receitaCents: 0, comissaoCents: 0, materialCents: 0, taxaCents: 0, descontoCents: 0 }
}

function dominante(a: Acumulado): ParcelaDominante {
  // Empate resolve pela ordem comissão → material → taxa, que é a ordem de grandeza típica no
  // setor. Empate exato entre duas parcelas em centavos é raro e não muda a conversa do dono.
  if (a.comissaoCents >= a.materialCents && a.comissaoCents >= a.taxaCents) return 'comissao'
  if (a.materialCents >= a.taxaCents) return 'material'
  return 'taxa'
}

export function margemPorServico(comandas: readonly ComandaFechada[]): MargemDoServico[] {
  const porServico = new Map<string, Acumulado>()

  for (const comanda of comandas) {
    const pesos = comanda.itens.map((i) => ({ chave: i.serviceId, totalCents: i.totalCents }))
    /*
     * O desconto e a taxa da comanda viram fatias por serviço com a mesma função que rateia o
     * lucro por profissional — inclusive a sobra de arredondamento, que vai para a maior fatia em
     * vez de sumir. Reescrever a divisão aqui produziria totais que não fecham com o caixa.
     */
    const descontoPorServico = ratearLucroDaComanda(comanda.discountCents, pesos)
    const taxaPorServico = ratearLucroDaComanda(comanda.feeCents, pesos)

    const tocados = new Set<string>()
    for (const item of comanda.itens) {
      if (!item.serviceId) continue
      const acc = porServico.get(item.serviceId) ?? vazio()
      acc.receitaCents += item.totalCents
      acc.materialCents += item.costCents
      acc.comissaoCents += item.commissionCents
      porServico.set(item.serviceId, acc)
      tocados.add(item.serviceId)
    }

    for (const serviceId of tocados) {
      const acc = porServico.get(serviceId)!
      acc.atendimentos += 1
      acc.descontoCents += descontoPorServico.get(serviceId) ?? 0
      acc.taxaCents += taxaPorServico.get(serviceId) ?? 0
    }
  }

  return [...porServico]
    .map(([serviceId, a]) => {
      const receitaLiquidaCents = Math.max(0, a.receitaCents - a.descontoCents)
      const lucroCents = receitaLiquidaCents - a.materialCents - a.taxaCents - a.comissaoCents
      /*
       * Receita zero não vira margem: dividir por zero devolveria `Infinity`, e um serviço 100%
       * cortesia não diz nada sobre a saúde do preço dele.
       */
      const margemBps = receitaLiquidaCents > 0 ? Math.round((lucroCents / receitaLiquidaCents) * 10_000) : 0

      return {
        serviceId,
        atendimentos: a.atendimentos,
        receitaCents: receitaLiquidaCents,
        comissaoCents: a.comissaoCents,
        materialCents: a.materialCents,
        taxaCents: a.taxaCents,
        lucroCents,
        margemBps,
        parcelaDominante:
          a.atendimentos >= MINIMO_DE_ATENDIMENTOS && receitaLiquidaCents > 0 && margemBps < PISO_DE_MARGEM_BPS
            ? dominante(a)
            : null,
      }
    })
    .filter((m) => m.atendimentos >= MINIMO_DE_ATENDIMENTOS)
    .sort((a, b) => a.margemBps - b.margemBps)
}
