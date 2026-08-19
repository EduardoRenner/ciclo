import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { fichaDoCliente } from '@/server/services/crm'
import { lerConfigFidelidade, listarPlanos } from '@/server/services/fidelidade'
import { listarModelos } from '@/server/services/mensagens-prontas'
import { listarProfissionais } from '@/server/services/profissionais'

import Ficha from './ficha'

export const dynamic = 'force-dynamic'

export default async function PaginaFicha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await contextoAtual(new Request('https://interno/clientes', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [ficha, modelos, negocio, planos, profissionais] = await Promise.all([
    fichaDoCliente(db, ctx.tenantId, id).catch((erro: unknown) => {
      if (erro instanceof AppError && erro.code === 'NOT_FOUND') return null
      throw erro
    }),
    listarModelos(db, ctx.tenantId),
    db.from('tenants').select('name, vertical, settings').eq('id', ctx.tenantId).single(),
    listarPlanos(db, ctx.tenantId),
    listarProfissionais(db, ctx.tenantId),
  ])

  if (!ficha) notFound()

  return (
    <Ficha
      ficha={ficha}
      modelos={modelos.filter((m) => m.active)}
      nomeDoNegocio={negocio.data?.name ?? ''}
      vertical={negocio.data?.vertical ?? 'barber'}
      planos={planos.filter((p) => p.active)}
      profissionais={profissionais.map((p) => ({ id: p.id, name: p.display_name }))}
      configFidelidade={lerConfigFidelidade(negocio.data?.settings)}
    />
  )
}
