import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarServicos } from '@/server/services/servicos'
import { headers } from 'next/headers'

import ListaServicos from './lista'

/**
 * Server Component: a lista chega pronta no primeiro paint (§10 pede LCP < 2s
 * no 4G). A interação — arquivar, reordenar — é do componente cliente.
 */
export default async function PaginaServicos() {
  const ctx = await contextoAtual(new Request('https://interno/config/servicos', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const servicos = await listarServicos(db, ctx.tenantId, true)

  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Serviços</h1>
        <p className="mt-1 text-secundario text-txt-2">
          O que você oferece, quanto dura e quanto custa. Arraste para mudar a ordem que a cliente vê.
        </p>
      </header>

      <ListaServicos iniciais={servicos} />
    </>
  )
}
