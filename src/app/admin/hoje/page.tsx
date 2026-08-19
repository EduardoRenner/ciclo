import { ExternalLink } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { resumoDeHoje } from '@/server/services/resumo-hoje'

import Hoje from './hoje'

export default async function PaginaHoje() {
  const ctx = await contextoAtual(new Request('https://interno/hoje', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const { data: tenantRow } = await db.from('tenants').select('name, slug, timezone').eq('id', ctx.tenantId).single()
  const resumo = await resumoDeHoje(db, ctx.tenantId, tenantRow?.timezone ?? 'America/Sao_Paulo')

  return (
    <>
      <header className="flex items-start justify-between gap-3 py-6">
        <div>
          <p className="text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
          <h1 className="mt-1 text-titulo font-extrabold">{tenantRow?.name ?? 'Hoje'}</h1>
        </div>
        {tenantRow?.slug ? (
          <Link
            href={`/${tenantRow.slug}`}
            target="_blank"
            className="mt-1 flex shrink-0 items-center gap-1 text-label font-semibold text-acc-2"
          >
            Ver meu site
            <ExternalLink aria-hidden className="size-3.5" />
          </Link>
        ) : null}
      </header>

      <Hoje resumo={resumo} />
    </>
  )
}
