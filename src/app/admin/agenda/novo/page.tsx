import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarProfissionais } from '@/server/services/profissionais'
import { listarServicos } from '@/server/services/servicos'

import FormularioAgendamento from './formulario'
import PageHeader from '@/components/ui/page-header'

export const metadata = { title: "Novo agendamento" }

export default async function PaginaNovoAgendamento() {
  const ctx = await contextoAtual(new Request('https://interno/agenda/novo', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [servicos, profissionais] = await Promise.all([
    listarServicos(db, ctx.tenantId),
    listarProfissionais(db, ctx.tenantId),
  ])

  return (
    <>
      <PageHeader titulo="Novo agendamento" />

      <FormularioAgendamento
        servicos={servicos.map((s) => ({
          id: s.id,
          name: s.name,
          duration_min: s.duration_min,
          price_cents: s.price_cents,
          pricing_model: s.pricing_model,
          hourly_rate_cents: s.hourly_rate_cents,
          half_day_price_cents: s.half_day_price_cents,
        }))}
        profissionais={profissionais.map((p) => ({ id: p.id, display_name: p.display_name }))}
      />
    </>
  )
}
