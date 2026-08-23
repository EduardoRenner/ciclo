import { headers } from 'next/headers'

import PageHeader from '@/components/ui/page-header'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarAgendaDoDia } from '@/server/services/agendamentos'
import { listarProfissionais } from '@/server/services/profissionais'

import Agenda from './agenda'

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export const metadata = { title: "Agenda" }

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; professionalId?: string }>
}) {
  const { date, professionalId } = await searchParams
  const diaAlvo = date ?? hojeISO()

  const ctx = await contextoAtual(new Request('https://interno/agenda', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const { data: tenantRow } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).single()
  const timezone = tenantRow?.timezone ?? 'America/Sao_Paulo'

  const [resumo, profissionais] = await Promise.all([
    listarAgendaDoDia(db, ctx.tenantId, diaAlvo, timezone, professionalId),
    listarProfissionais(db, ctx.tenantId),
  ])

  return (
    <>
      <PageHeader titulo="Agenda" />

      <Agenda
        dia={diaAlvo}
        resumo={resumo}
        profissionais={profissionais.map((p) => ({ id: p.id, display_name: p.display_name }))}
        profissionalSelecionado={professionalId}
      />
    </>
  )
}
