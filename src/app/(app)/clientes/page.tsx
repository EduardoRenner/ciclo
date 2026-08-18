import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarClientes } from '@/server/services/clientes'

import ListaClientes from './lista'

export default async function PaginaClientes() {
  const ctx = await contextoAtual(new Request('https://interno/clientes', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const clientes = await listarClientes(db, ctx.tenantId)

  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Clientes</h1>
        <p className="mt-1 text-secundario text-txt-2">Busque por nome ou telefone.</p>
      </header>

      <ListaClientes iniciais={clientes} />
    </>
  )
}
