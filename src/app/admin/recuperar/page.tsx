import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { Temporal } from '@js-temporal/polyfill'

import { podeUsarCapacidade } from '@/core/billing/planos'
import AlertBanner from '@/components/ui/alert-banner'
import PageHeader from '@/components/ui/page-header'
import { dinheiro } from '@/lib/formato'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDePlano } from '@/server/services/planos'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { receitaAtribuidaAoCiclo } from '@/server/services/atribuicao'

import RecuperarReceita from './recuperar'

export const metadata = { title: "Recuperar receita" }

export default async function PaginaRecuperar() {
  const ctx = await contextoAtual(new Request('https://interno/recuperar', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const { data: tenant } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).maybeSingle()
  const timezone = tenant?.timezone ?? 'America/Sao_Paulo'
  const mesAtual = Temporal.PlainYearMonth.from(Temporal.Now.zonedDateTimeISO(timezone).toPlainDate())
  const desde = mesAtual.toPlainDate({ day: 1 }).toString()
  const ate = mesAtual.toPlainDate({ day: mesAtual.daysInMonth }).toString()

  const [lista, atribuicao, plano] = await Promise.all([
    listarParaRecuperar(db, ctx.tenantId),
    receitaAtribuidaAoCiclo(db, ctx.tenantId, desde, ate),
    contextoDePlano(db, ctx.tenantId),
  ])

  // A tela precisa saber para desenhar o caminho certo; quem RECUSA é a rota (§L.1). Aqui é
  // desenho, não segurança.
  const podeEnviarEmLote = podeUsarCapacidade(plano, 'envio_em_lote').estado === 'liberado'

  return (
    <>
      {/*
        Campanha mora no hub de "Configurações" — que é onde se ajusta o negócio,
        não onde se trabalha. Quem está nesta tela é exatamente quem quer chamar
        gente de volta em lote e ver quanto voltou; o atalho vive aqui, sem
        precisar mudar a arquitetura de navegação inteira por causa de dois itens.
      */}
      <PageHeader
        titulo="Recuperar receita"
        descricao="Clientes que o Motor de Ciclo identificou como atrasadas para voltar."
        acao={
          <Link
            href="/admin/campanhas"
            className="flex h-12 items-center gap-1 text-label font-semibold text-acc-2 transition active:scale-[.97]"
          >
            Campanhas
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        }
      />

      {atribuicao.count > 0 ? (
        <AlertBanner className="mb-5">
          O Motor de Ciclo trouxe{' '}
          <strong className="font-bold text-acc-2">{dinheiro.format(atribuicao.totalCents / 100)}</strong> este mês (
          {atribuicao.count} {atribuicao.count === 1 ? 'agendamento' : 'agendamentos'}).
        </AlertBanner>
      ) : null}

      <RecuperarReceita inicial={lista} podeEnviarEmLote={podeEnviarEmLote} />
    </>
  )
}
