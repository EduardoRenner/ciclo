import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarProfissionais } from '@/server/services/profissionais'
import { listarServicos } from '@/server/services/servicos'

import FormularioAgendamento from './formulario'

export default async function PaginaNovoAgendamento() {
  const ctx = await contextoAtual(new Request('https://interno/agenda/novo', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [servicos, profissionais] = await Promise.all([
    listarServicos(db, ctx.tenantId),
    listarProfissionais(db, ctx.tenantId),
  ])

  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Novo agendamento</h1>
      </header>

      <FormularioAgendamento
        servicos={servicos.map((s) => ({ id: s.id, name: s.name, duration_min: s.duration_min, price_cents: s.price_cents }))}
        profissionais={profissionais.map((p) => ({ id: p.id, display_name: p.display_name }))}
      />
    </>
  )
}
