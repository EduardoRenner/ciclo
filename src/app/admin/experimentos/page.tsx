import { headers } from 'next/headers'
import Link from 'next/link'
import { Lock } from 'lucide-react'

import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { diaNoFuso } from '@/core/tempo/dia'
import { avaliarPermissao } from '@/server/auth/rbac'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarExperimentos } from '@/server/services/experimentos'

import Experimentos from './experimentos'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Testes' }

/**
 * `docs/84` Aposta C — o dono muda uma coisa por alguns dias e o CICLO compara com os mesmos dias
 * de antes. Ler é número de dinheiro atendido: a mesma trava de "O mês" (`report:read`). Criar e
 * cancelar é a de mudar o negócio (`tenant:update`), conferida de novo na rota.
 */
export default async function PaginaDeTestes() {
  const ctx = await contextoDoPainel(new Request('https://interno/experimentos', { headers: await headers() }))

  if (!avaliarPermissao(ctx.papel, 'report:read')) {
    return (
      <>
        <PageHeader titulo="Testes" />
        <Card className="p-0">
          <EmptyState
            icone={<Lock aria-hidden className="size-6" />}
            titulo="Você não tem acesso aos testes"
            descricao="Eles mostram o movimento e o valor atendido do negócio. Peça ao dono se precisar."
            acao={<Link href="/admin/hoje">Voltar para Hoje</Link>}
          />
        </Card>
      </>
    )
  }

  const db = await criarClienteDoUsuario()
  const lista = await listarExperimentos(db, ctx.tenantId, ctx.tenant.timezone)

  return (
    <>
      <PageHeader
        titulo="Testes"
        descricao="Mude uma coisa por alguns dias e compare com os mesmos dias de antes. É teste prático, não prova."
      />
      <Experimentos inicial={lista} podeCriar={avaliarPermissao(ctx.papel, 'tenant:update') !== null} hoje={diaNoFuso(ctx.tenant.timezone)} />
    </>
  )
}
