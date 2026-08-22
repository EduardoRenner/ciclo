import { Temporal } from '@js-temporal/polyfill'

import { calcularDiasDeCobertura, estadoValidade, precisaRecomprar, type EstadoValidade } from '@/core/estoque/alertas'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const JANELA_CONSUMO_DIAS = 30
/** Teto de linhas que o PostgREST devolve numa consulta sem `range`. */
const TAMANHO_PAGINA = 1000

export type AlertaEstoque = {
  productId: string
  name: string
  stockQty: number
  reorderPoint: number
  diasDeCobertura: number | null
  precisaRecomprar: boolean
  validade: EstadoValidade
}

/**
 * TICKET-045 (§5.6). Consumo médio diário = soma de tudo que saiu (`stock_moves.kind = 'out'`)
 * nos últimos 30 dias, dividido por 30 — mesmo produto que não vendeu nada nesse período tem
 * `diasDeCobertura = null` (não "infinito"), porque não há base pra prever quando acaba.
 */
export async function listarAlertasDeEstoque(db: Cliente, tenantId: string, hoje: string): Promise<AlertaEstoque[]> {
  const hojePlain = Temporal.PlainDate.from(hoje)
  const desde = hojePlain.subtract({ days: JANELA_CONSUMO_DIAS }).toString()

  const [{ data: produtos, error: erroProdutos }, { data: saidas, error: erroSaidas }] = await Promise.all([
    db.from('products').select('id, name, stock_qty, reorder_point, expires_at').eq('tenant_id', tenantId).eq('active', true).is('deleted_at', null),
    db.from('stock_moves').select('product_id, qty').eq('tenant_id', tenantId).eq('kind', 'out').gte('created_at', `${desde}T00:00:00Z`),
  ])
  if (erroProdutos) throw new AppError('INTERNAL', { cause: erroProdutos })
  if (erroSaidas) throw new AppError('INTERNAL', { cause: erroSaidas })

  const consumoTotalPorProduto = new Map<string, number>()
  for (const saida of saidas ?? []) {
    consumoTotalPorProduto.set(saida.product_id, (consumoTotalPorProduto.get(saida.product_id) ?? 0) + Math.abs(saida.qty))
  }

  /*
   * O catálogo do pacote da profissão (`apply_vertical_pack`) nasce com produto
   * de estoque 0 e ponto de pedido > 0 — e `precisaRecomprar` é verdadeiro assim
   * que `estoque <= ponto de pedido`. Resultado, antes desta trava: TODA conta
   * nova abria "Hoje" com meia dúzia de alertas de recompra de produto que nunca
   * comprou, sem nenhuma forma de calar — alarme que ninguém consegue resolver
   * ensina a ignorar todos os outros. Só alerta produto que este salão de fato
   * acompanha: tem estoque, consumiu nos últimos 30 dias, ou já registrou algum
   * movimento algum dia. Quem nunca usou controle de estoque não recebe nada.
   */
  const candidatos = (produtos ?? []).filter((produto) => {
    const consumo = consumoTotalPorProduto.get(produto.id) ?? 0
    const diasDeCobertura = calcularDiasDeCobertura(produto.stock_qty, consumo / JANELA_CONSUMO_DIAS)
    const recompra = precisaRecomprar({ estoqueAtualQty: produto.stock_qty, reorderPointQty: produto.reorder_point, diasDeCobertura })
    const validade = estadoValidade(hojePlain, produto.expires_at ? Temporal.PlainDate.from(produto.expires_at) : null)
    return recompra || validade !== 'ok'
  })

  const acompanhados = new Set<string>()
  // Estoque na prateleira ou consumo recente já provam que o salão acompanha o
  // produto, sem custar consulta nenhuma. Só o resto precisa olhar o histórico.
  const semSinalDireto = candidatos.filter((produto) => {
    if (produto.stock_qty > 0 || (consumoTotalPorProduto.get(produto.id) ?? 0) > 0) {
      acompanhados.add(produto.id)
      return false
    }
    return true
  })

  if (semSinalDireto.length > 0) {
    const ids = semSinalDireto.map((p) => p.id)
    const { data: movimentos, error: erroMovimentos } = await db
      .from('stock_moves')
      .select('product_id')
      .eq('tenant_id', tenantId)
      .in('product_id', ids)
      .limit(TAMANHO_PAGINA)
    if (erroMovimentos) throw new AppError('INTERNAL', { cause: erroMovimentos })

    for (const m of movimentos ?? []) acompanhados.add(m.product_id)

    /*
     * Uma consulta só resolve o caso normal — mas o PostgREST corta em
     * `TAMANHO_PAGINA` linhas, e um único produto muito movimentado pode
     * consumir a página inteira e esconder os outros. Ausência só é conclusiva
     * quando o resultado veio abaixo do corte; quando bateu no teto, os que
     * faltaram são conferidos um a um. Esta tela roda a cada carregamento de
     * "Hoje": N consultas por padrão seria caro à toa.
     */
    if ((movimentos?.length ?? 0) >= TAMANHO_PAGINA) {
      const duvidosos = ids.filter((id) => !acompanhados.has(id))
      await Promise.all(
        duvidosos.map(async (id) => {
          const { count } = await db
            .from('stock_moves')
            .select('product_id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('product_id', id)
            .limit(1)
          if ((count ?? 0) > 0) acompanhados.add(id)
        }),
      )
    }
  }

  const alertas: AlertaEstoque[] = []
  for (const produto of candidatos) {
    if (!acompanhados.has(produto.id)) continue

    const consumoMedioDiario = (consumoTotalPorProduto.get(produto.id) ?? 0) / JANELA_CONSUMO_DIAS
    const diasDeCobertura = calcularDiasDeCobertura(produto.stock_qty, consumoMedioDiario)
    const recompra = precisaRecomprar({ estoqueAtualQty: produto.stock_qty, reorderPointQty: produto.reorder_point, diasDeCobertura })
    const validade = estadoValidade(hojePlain, produto.expires_at ? Temporal.PlainDate.from(produto.expires_at) : null)

    alertas.push({
      productId: produto.id,
      name: produto.name,
      stockQty: produto.stock_qty,
      reorderPoint: produto.reorder_point,
      diasDeCobertura,
      precisaRecomprar: recompra,
      validade,
    })
  }

  return alertas
}
