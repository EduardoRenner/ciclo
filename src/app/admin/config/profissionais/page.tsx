import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarConvites } from '@/server/services/convites'
import { listarProfissionais } from '@/server/services/profissionais'

import ListaProfissionais from './lista'

export default async function PaginaProfissionais() {
  const ctx = await contextoAtual(new Request('https://interno/config/profissionais', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const [profissionais, convites] = await Promise.all([
    listarProfissionais(db, ctx.tenantId, true),
    listarConvites(db, ctx.tenantId),
  ])

  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Time</h1>
        <p className="mt-1 text-secundario text-txt-2">Quem atende, expediente e quem você já convidou.</p>
      </header>

      <ListaProfissionais profissionaisIniciais={profissionais} convitesIniciais={convites} />
    </>
  )
}
