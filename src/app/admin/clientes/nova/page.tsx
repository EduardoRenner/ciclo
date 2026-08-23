import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'

import FormularioCliente from './formulario'

export const dynamic = 'force-dynamic'

export const metadata = { title: "Novo cliente" }

export default async function PaginaNovoCliente() {
  const ctx = await contextoAtual(new Request('https://interno/clientes/nova', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const { data } = await db.from('tenants').select('vertical').eq('id', ctx.tenantId).single()

  return <FormularioCliente vertical={data?.vertical ?? 'barber'} />
}
