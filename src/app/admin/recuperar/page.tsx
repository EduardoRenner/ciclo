import { headers } from 'next/headers'
import { Temporal } from '@js-temporal/polyfill'

import AlertBanner from '@/components/ui/alert-banner'
import PageHeader from '@/components/ui/page-header'
import { dinheiro } from '@/lib/formato'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { receitaAtribuidaAoCiclo } from '@/server/services/atribuicao'

import RecuperarReceita from './recuperar'

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
      <PageHeader
        titulo="Recuperar receita"
        descricao="Clientes que o Motor de Ciclo identificou como atrasadas para voltar."
      />

      {atribuicao.count > 0 ? (
        <AlertBanner className="mb-5">
          O Motor de Ciclo trouxe{' '}
          <strong className="font-bold text-acc-2">{dinheiro.format(atribuicao.totalCents / 100)}</strong> este mês (
          {atribuicao.count} {atribuicao.count === 1 ? 'agendamento' : 'agendamentos'}).
        </AlertBanner>
      ) : null}

      <RecuperarReceita inicial={lista} />
    </>
  )
}
