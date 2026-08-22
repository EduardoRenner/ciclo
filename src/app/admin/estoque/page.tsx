import { headers } from 'next/headers'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Temporal } from '@js-temporal/polyfill'

import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { avaliarPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarAlertasDeEstoque } from '@/server/services/alertas-estoque'

import ListaEstoque from './lista'

/**
 * O estoque era meio produto: a comanda dava baixa (TICKET-044), "Hoje" avisava
 * para recomprar (TICKET-045) e `POST /inventory/entries` sabia registrar
 * compra (TICKET-047) — mas não existia nenhuma tela, então o número só descia.
 * Sem isto, o alerta de recompra é um aviso que ninguém consegue resolver.
 */
export default async function PaginaEstoque() {
  const ctx = await contextoAtual(new Request('https://interno/estoque', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  if (!avaliarPermissao(ctx.papel, 'inventory:read')) {
    return (
      <>
        <PageHeader titulo="Estoque" />
        <Card className="p-0">
          <EmptyState
            icone={<Lock aria-hidden className="size-6" />}
            titulo="Você não tem acesso ao estoque"
            descricao="Quem cuida das compras do salão vê esta tela. Peça ao dono se precisar."
            acao={<Link href="/admin/hoje">Voltar para Hoje</Link>}
          />
        </Card>
      </>
    )
  }

  const { data: tenantRow } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).single()
  const timezone = tenantRow?.timezone ?? 'America/Sao_Paulo'
  const hoje = Temporal.Now.instant().toZonedDateTimeISO(timezone).toPlainDate().toString()

  const [{ data: produtos }, alertas] = await Promise.all([
    db
      .from('products')
      .select('id, name, unit, stock_qty, reorder_point, avg_cost_cents, expires_at')
      .eq('tenant_id', ctx.tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .order('name'),
    listarAlertasDeEstoque(db, ctx.tenantId, hoje),
  ])

  const emAlerta = new Set(alertas.map((a) => a.productId))

  return (
    <>
      <PageHeader
        titulo="Estoque"
        descricao={
          alertas.length > 0
            ? `${alertas.length} ${alertas.length === 1 ? 'produto precisa de atenção' : 'produtos precisam de atenção'}`
            : 'Quanto tem de cada produto e o custo médio'
        }
      />
      <ListaEstoque
        produtos={(produtos ?? []).map((p) => ({
          id: p.id,
          nome: p.name,
          unidade: p.unit,
          estoque: p.stock_qty,
          pontoDePedido: p.reorder_point,
          custoMedioCents: p.avg_cost_cents,
          venceEm: p.expires_at,
          emAlerta: emAlerta.has(p.id),
        }))}
      />
    </>
  )
}
