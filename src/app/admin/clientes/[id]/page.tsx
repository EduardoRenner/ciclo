import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { fichaDoCliente } from '@/server/services/crm'
import { listarModelos } from '@/server/services/mensagens-prontas'

import Ficha from './ficha'

export const dynamic = 'force-dynamic'

export default async function PaginaFicha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await contextoAtual(new Request('https://interno/clientes', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [ficha, modelos, negocio] = await Promise.all([
    fichaDoCliente(db, ctx.tenantId, id).catch((erro: unknown) => {
      if (erro instanceof AppError && erro.code === 'NOT_FOUND') return null
      throw erro
    }),
    listarModelos(db, ctx.tenantId),
    db.from('tenants').select('name, vertical').eq('id', ctx.tenantId).single(),
  ])

  if (!ficha) notFound()

  return (
    <Ficha
      ficha={ficha}
      modelos={modelos.filter((m) => m.active)}
      nomeDoNegocio={negocio.data?.name ?? ''}
      vertical={negocio.data?.vertical ?? 'barber'}
    />
  )
}
