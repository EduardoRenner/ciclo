import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarPlanos } from '@/server/services/fidelidade'

import EditorPlanos from './editor'

export const dynamic = 'force-dynamic'

export default async function PaginaPlanos() {
  const ctx = await contextoAtual(new Request('https://interno/config/planos', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const planos = await listarPlanos(db, ctx.tenantId)

  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Clube de assinatura</h1>
        <p className="mt-1 text-secundario text-txt-2">Planos mensais que o cliente assina direto na ficha dele.</p>
      </header>

      <EditorPlanos iniciais={planos} />
    </>
  )
}
