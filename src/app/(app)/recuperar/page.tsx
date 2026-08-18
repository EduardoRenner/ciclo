import { headers } from 'next/headers'
import { Temporal } from '@js-temporal/polyfill'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { receitaAtribuidaAoCiclo } from '@/server/services/atribuicao'

import RecuperarReceita from './recuperar'

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function PaginaRecuperar() {
  const ctx = await contextoAtual(new Request('https://interno/recuperar', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const { data: tenant } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).maybeSingle()
  const timezone = tenant?.timezone ?? 'America/Sao_Paulo'
  const mesAtual = Temporal.PlainYearMonth.from(Temporal.Now.zonedDateTimeISO(timezone).toPlainDate())
  const desde = mesAtual.toPlainDate({ day: 1 }).toString()
  const ate = mesAtual.toPlainDate({ day: mesAtual.daysInMonth }).toString()

  const [lista, atribuicao] = await Promise.all([
    listarParaRecuperar(db, ctx.tenantId),
    receitaAtribuidaAoCiclo(db, ctx.tenantId, desde, ate),
  ])

  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Recuperar receita</h1>
        <p className="mt-1 text-secundario text-txt-2">Clientes que o Motor de Ciclo identificou como atrasadas para voltar.</p>
      </header>

      {atribuicao.count > 0 ? (
        <p className="mb-5 rounded-[var(--radius-sm)] border border-acc-2 bg-acc-soft p-3 text-secundario text-txt">
          O Motor de Ciclo trouxe <strong className="font-bold text-acc-2">{dinheiro.format(atribuicao.totalCents / 100)}</strong> este mês
          {' '}({atribuicao.count} {atribuicao.count === 1 ? 'agendamento' : 'agendamentos'}).
        </p>
      ) : null}

      <RecuperarReceita inicial={lista} />
    </>
  )
}
