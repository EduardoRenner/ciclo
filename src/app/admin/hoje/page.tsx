import { ExternalLink } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Temporal } from '@js-temporal/polyfill'

import PageHeader from '@/components/ui/page-header'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { receitaAtribuidaAoCiclo } from '@/server/services/atribuicao'
import { centralDeAcoes } from '@/server/services/crm'
import { resumoDeHoje } from '@/server/services/resumo-hoje'

import CentralDeAcoes from './central-de-acoes'
import CompartilharSite from './compartilhar'
import Hoje from './hoje'

/** Saudação pelo horário do salão, não pelo do servidor (que roda em UTC na Vercel). */
function saudacao(timezone: string): string {
  const hora = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: timezone }).format(new Date()))
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

export const metadata = { title: "Hoje" }

export default async function PaginaHoje() {
  const ctx = await contextoAtual(new Request('https://interno/hoje', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  // Vem junto do `select` que revalida o membership — era uma ida de rede serial, e o
  // `timezone` decide o intervalo de tudo que vem depois (`docs/28` §8).
  const timezone = ctx.tenant.timezone
  const mesAtual = Temporal.PlainYearMonth.from(Temporal.Now.zonedDateTimeISO(timezone).toPlainDate())
  const desde = mesAtual.toPlainDate({ day: 1 }).toString()
  const ate = mesAtual.toPlainDate({ day: mesAtual.daysInMonth }).toString()

  const [resumo, acoes, atribuicao] = await Promise.all([
    resumoDeHoje(db, ctx.tenantId, timezone),
    // Nunca derruba "Hoje": um resumo de CRM que falhar vira lista vazia, não erro na tela mais
    // importante do app.
    centralDeAcoes(db, ctx.tenantId).catch(() => ({ titulo: '', acoes: [] })),
    // F1 (docs/25-ESTRATEGIA-E-EXECUCAO.md): em dia sem movimento, o herói mostra o que o Motor
    // de Ciclo já trouxe este mês em vez de R$ 0,00. Mesmo cálculo de `/admin/recuperar`.
    receitaAtribuidaAoCiclo(db, ctx.tenantId, desde, ate).catch(() => ({ totalCents: 0, count: 0, items: [] })),
  ])

  const data = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: timezone,
  }).format(new Date())

  return (
    <>
      {/*
        O nome do salão era o título da tela — informação de peso zero (a pessoa
        sabe onde trabalha) ocupando o lugar mais nobre do app. O título passa a
        ser a saudação, que datava a tela e ancora o "agora"; o nome vira apoio,
        que ainda importa para quem gerencia mais de uma unidade.
      */}
      <PageHeader
        overline={data}
        titulo={saudacao(timezone)}
        descricao={ctx.tenant.name}
        acao={
          ctx.tenant.slug ? (
            <div className="flex items-center gap-1">
              <Link
                href={`/${ctx.tenant.slug}`}
                target="_blank"
                className="flex h-12 items-center gap-1 text-label font-semibold text-acc-2 transition active:scale-[.97]"
              >
                Ver meu site
                <ExternalLink aria-hidden className="size-3.5" />
              </Link>
              <CompartilharSite slug={ctx.tenant.slug} nome={ctx.tenant.name} />
            </div>
          ) : null
        }
      />

      <Hoje resumo={resumo} atribuicao={atribuicao}>
        <CentralDeAcoes dados={acoes} />
      </Hoje>
    </>
  )
}
