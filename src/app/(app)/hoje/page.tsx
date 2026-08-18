import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { resumoDeHoje } from '@/server/services/resumo-hoje'

import Hoje from './hoje'

export default async function PaginaHoje() {
  const ctx = await contextoAtual(new Request('https://interno/hoje', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const { data: tenantRow } = await db.from('tenants').select('name, timezone').eq('id', ctx.tenantId).single()
  const resumo = await resumoDeHoje(db, ctx.tenantId, tenantRow?.timezone ?? 'America/Sao_Paulo')

  return (
    <>
      <header className="py-6">
        <p className="text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>
        <h1 className="mt-1 text-titulo font-extrabold">{tenantRow?.name ?? 'Hoje'}</h1>
      </header>

      <Hoje resumo={resumo} />
    </>
  )
}
