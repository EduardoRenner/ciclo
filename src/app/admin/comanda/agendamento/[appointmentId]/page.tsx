import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { buscarTicketIdPorAgendamento } from '@/server/services/comanda'

export const metadata = { title: "Comanda" }

export default async function RedirecionarParaComanda({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params
  const ctx = await contextoAtual(new Request('https://interno/comanda', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const ticketId = await buscarTicketIdPorAgendamento(db, ctx.tenantId, appointmentId)
  if (!ticketId) notFound()
  redirect(`/admin/comanda/${ticketId}`)
}
