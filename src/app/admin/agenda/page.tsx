import { Temporal } from '@js-temporal/polyfill'
import { headers } from 'next/headers'

import PageHeader from '@/components/ui/page-header'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarAgendaDoDia } from '@/server/services/agendamentos'
import { listarProfissionais } from '@/server/services/profissionais'

import Agenda from './agenda'

export const metadata = { title: "Agenda" }

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; professionalId?: string }>
}) {
  const { date, professionalId } = await searchParams

  const ctx = await contextoAtual(new Request('https://interno/agenda', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  // `docs/28` §8: o `timezone` chega no contexto, sem segunda ida ao banco.
  const timezone = ctx.tenant.timezone

  /*
   * O dia padrão saía de `new Date().toISOString().slice(0, 10)` — "hoje em
   * UTC", não hoje no salão. Em Brasília (UTC-3) isso devolve o dia SEGUINTE
   * das 21h à meia-noite: o dono fechava a barbearia às 21h30, abria a agenda
   * e via amanhã. Três horas erradas por noite, todas as noites.
   *
   * Por isso o cálculo desceu para depois do `timezone`: é a regra 4 do
   * CLAUDE.md (converter para o fuso do tenant só na apresentação), e é o que
   * `/admin/caixa` — a tela irmã — já fazia. Nenhuma consulta a mais: o fuso
   * já era buscado aqui.
   */
  const diaAlvo = date ?? Temporal.Now.instant().toZonedDateTimeISO(timezone).toPlainDate().toString()

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
