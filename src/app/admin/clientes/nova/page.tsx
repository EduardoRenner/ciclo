import { headers } from 'next/headers'

import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'

import FormularioCliente from './formulario'

export const dynamic = 'force-dynamic'

export const metadata = { title: "Novo cliente" }

export default async function PaginaNovoCliente() {
  const ctx = await contextoDoPainel(new Request('https://interno/clientes/nova', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const { data } = await db.from('tenants').select('vertical').eq('id', ctx.tenantId).single()

  // `head: true` não traz linha nenhuma, só a contagem — não pesa mais que a consulta que já
  // existia. Usado só para a mensagem de "primeiro cliente" (docs/61 §5.6), sem outro efeito.
  const { count } = await db.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', ctx.tenantId)

  return <FormularioCliente vertical={data?.vertical ?? 'barber'} ehPrimeiroCliente={(count ?? 0) === 0} />
}
