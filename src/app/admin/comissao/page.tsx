import { Lock, UserX } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Temporal } from '@js-temporal/polyfill'

import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { dinheiro } from '@/lib/formato'
import { avaliarPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { extratoDeComissao } from '@/server/services/comissao'
import { AppError } from '@/server/http/errors'

export const metadata = { title: 'Minha comissão' }

/**
 * `docs/53` C-01 — a tela que faltava para `extratoDeComissao`/`commissions/extract` deixarem de
 * ser função sem leitor (`docs/52` §2.2): a comissão já vinha congelada no fechamento de cada item
 * desde o TICKET-046; o que nunca existiu foi uma rota que o profissional comissionado alcançasse.
 *
 * Alcance `own`: nunca aceita um `professionalId` de fora — resolve o "próprio" por
 * `my_professional_id`, a mesma função que a RLS usa em `can_see_appointment`. Ver
 * `resolverProfessionalIdDoExtrato` em `api/v1/commissions/extract/route.ts` para a mesma trava
 * do lado da API.
 */
export default async function PaginaComissao() {
  const ctx = await contextoAtual(new Request('https://interno/comissao', { headers: await headers() }))
  const escopo = avaliarPermissao(ctx.papel, 'commission:read')

  if (!escopo) {
    return (
      <>
        <PageHeader titulo="Minha comissão" />
        <Card className="p-0">
          <EmptyState
            icone={<Lock aria-hidden className="size-6" />}
            titulo="Você não tem acesso a esta tela"
            descricao="Só quem atende ou cuida do financeiro vê a comissão. Peça ao dono se precisar."
            acao={<Link href="/admin/hoje">Voltar para Hoje</Link>}
          />
        </Card>
      </>
    )
  }

  const db = await criarClienteDoUsuario()
  const timezone = ctx.tenant.timezone

  // `all` é owner/finance — eles já veem o total por profissional no Caixa (`caixa/page.tsx`). O
  // extrato item a item para QUALQUER profissional escolhido é trabalho maior que este ticket
  // pediu (um seletor de profissional, não só "o próprio"), e fica para quando alguém pedir.
  if (escopo === 'all') {
    return (
      <>
        <PageHeader titulo="Comissão" descricao="O extrato item a item de cada profissional." />
        <Card>
          <p className="text-corpo text-txt-2">
            O total de comissão por profissional já está no{' '}
            <Link href="/admin/caixa" className="font-semibold text-acc-2">
              Caixa
            </Link>
            . O extrato item a item de um profissional específico chega aqui em breve.
          </p>
        </Card>
      </>
    )
  }

  const { data: proprioId, error } = await db.rpc('my_professional_id', { t: ctx.tenantId })
  if (error) throw new AppError('INTERNAL', { cause: error })

  if (!proprioId) {
    return (
      <>
        <PageHeader titulo="Minha comissão" />
        <Card className="p-0">
          <EmptyState
            icone={<UserX aria-hidden className="size-6" />}
            titulo="Sua conta ainda não está ligada a um cadastro de profissional"
            descricao="Peça ao dono para te vincular na tela de Time."
            acao={<Link href="/admin/hoje">Voltar para Hoje</Link>}
          />
        </Card>
      </>
    )
  }

  const hoje = Temporal.Now.zonedDateTimeISO(timezone).toPlainDate()
  const anoMes = Temporal.PlainYearMonth.from(hoje)
  const desde = anoMes.toPlainDate({ day: 1 }).toString()
  const ate = anoMes.toPlainDate({ day: anoMes.daysInMonth }).toString()

  const extrato = await extratoDeComissao(db, ctx.tenantId, proprioId, timezone, desde, ate)
  const formatarData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: timezone })

  return (
    <>
      <PageHeader titulo="Minha comissão" descricao="Este mês, item a item: o valor de cada linha é o que foi congelado no fechamento daquela comanda." />

      <Card>
        <p className="text-overline font-semibold uppercase text-txt-3">Total do mês</p>
        <p className="tabular mt-1.5 text-numero font-bold text-txt">{dinheiro.format(extrato.totalCents / 100)}</p>
      </Card>

      {extrato.items.length === 0 ? (
        <p className="mt-4 text-corpo text-txt-2">Nenhum atendimento seu fechou comissão este mês ainda.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {extrato.items.map((item) => (
            <li key={item.itemId}>
              <Card className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-corpo font-semibold">{item.description}</p>
                  <p className="text-secundario text-txt-2">{formatarData.format(new Date(item.closedAt))}</p>
                </div>
                <p className="tabular shrink-0 font-semibold text-txt">{dinheiro.format(item.commissionCents / 100)}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
