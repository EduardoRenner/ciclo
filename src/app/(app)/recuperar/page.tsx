import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'

import RecuperarReceita from './recuperar'

export default async function PaginaRecuperar() {
  const ctx = await contextoAtual(new Request('https://interno/recuperar', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const lista = await listarParaRecuperar(db, ctx.tenantId)

  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Recuperar receita</h1>
        <p className="mt-1 text-secundario text-txt-2">Clientes que o Motor de Ciclo identificou como atrasadas para voltar.</p>
      </header>

      <RecuperarReceita inicial={lista} />
    </>
  )
}
