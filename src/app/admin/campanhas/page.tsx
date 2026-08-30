import { Megaphone, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import SectionHeader from '@/components/ui/section-header'
import StatTile from '@/components/ui/stat-tile'
import PageHeader from '@/components/ui/page-header'
import { dinheiro } from '@/lib/formato'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'

export const dynamic = 'force-dynamic'

/** Barra do funil — largura proporcional ao topo, para a queda entre etapas ser visível. */
function Etapa({
  rotulo,
  valor,
  total,
  tom,
  base = false,
}: {
  rotulo: string
  valor: number
  total: number
  tom: string
  /** A etapa de topo é a régua das outras: mostrar "100%" nela só ocupa espaço sem informar. */
  base?: boolean
}) {
  // 2026-08-30, achado medindo a tela ao vivo, e corrigido duas vezes na mesma rodada:
  // 1ª leitura (errada): "444%" parecia uma taxa de conversão impossível (mais gente marcou
  // horário do que mensagens enviadas). Não era — `valor` (4) e `pct` (44%) já eram dois números
  // CORRETOS, só grudados sem separador de texto: o `ml-1.5` entre eles é `margin`, que afasta
  // visualmente mas não produz caractere nenhum — extração de texto (leitor de tela, copiar e
  // colar, e o teste automatizado que achou isto) lê "4" + "44%" = "444%", sem pausa. Manter o
  // teto `Math.min(100, ...)` mesmo assim: é rede de segurança correta para o dia em que a
  // atribuição de campanha existir de verdade e puder contar errado — só não é o que causava o
  // que foi visto aqui.
  // 2ª correção (a real): separador de texto de verdade entre `valor` e `pct`, não só espaço
  // visual — para quem lê a tela sem olhar (leitor de tela) ou copia o texto, ver os dois
  // números como dois números, não um só.
  const pctBruto = total > 0 ? (valor / total) * 100 : 0
  const pct = Math.round(Math.min(100, pctBruto))
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-secundario text-txt-2">{rotulo}</span>
        <span className="tabular text-corpo font-semibold">
          {valor}
          {base ? null : <span className="ml-1.5 text-secundario text-txt-3">· {pct}%</span>}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-[var(--radius-pill)] bg-surface-3">
        <div className={`h-full rounded-[var(--radius-pill)] ${tom}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  )
}

export const metadata = { title: "Campanhas" }

export default async function PaginaCampanhas() {
  const ctx = await contextoAtual(new Request('https://interno/campanhas', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const { data: campanhas } = await db
    .from('campaigns')
    .select('id, name, template, status, sent_count, booked_count, revenue_cents, created_at')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })

  const lista = campanhas ?? []
  const enviadas = lista.reduce((s, c) => s + c.sent_count, 0)
  const agendaram = lista.reduce((s, c) => s + c.booked_count, 0)
  const receita = lista.reduce((s, c) => s + c.revenue_cents, 0)

  return (
    <div className="pb-8">
      <PageHeader titulo="Campanhas" descricao="Quanto cada mensagem enviada virou cliente na cadeira." />

      <div className="grid grid-cols-2 gap-3">
        <StatTile rotulo="Receita gerada" valor={dinheiro.format(receita / 100)} />
        <StatTile
          rotulo="Viraram horário"
          valor={enviadas > 0 ? `${Math.round((agendaram / enviadas) * 100)}%` : '—'}
          progresso={enviadas > 0 ? agendaram / enviadas : 0}
        />
      </div>

      <Link href="/admin/campanhas/nova" className="mt-4 block">
        <Button largura="cheia">
          <Megaphone aria-hidden className="size-4" />
          Nova campanha
        </Button>
      </Link>

      <section className="mt-7">
        <SectionHeader icone={<TrendingUp className="size-3.5" />}>Resultados</SectionHeader>

        {lista.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icone={<Megaphone aria-hidden className="size-6" />}
              titulo="Nenhuma campanha ainda"
              descricao="Escolha um grupo de clientes, mande a mesma mensagem para todos e veja quantos voltaram."
              acao={<Link href="/admin/campanhas/nova">Criar a primeira</Link>}
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {lista.map((c) => (
              <li key={c.id}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-corpo font-semibold">{c.name}</p>
                    <p className="tabular shrink-0 text-corpo font-bold text-ok">
                      {dinheiro.format(c.revenue_cents / 100)}
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2.5">
                    <Etapa rotulo="Mensagens enviadas" valor={c.sent_count} total={c.sent_count} tom="bg-info" base />
                    <Etapa rotulo="Marcaram horário" valor={c.booked_count} total={c.sent_count} tom="bg-ok" />
                  </div>

                  {c.sent_count > 0 ? (
                    <p className="mt-3 text-secundario text-txt-3">
                      Cada mensagem valeu {dinheiro.format(c.revenue_cents / c.sent_count / 100)} em média.
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
