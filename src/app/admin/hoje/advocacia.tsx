import { AlertTriangle, CalendarClock, ChevronRight, FileText, Gavel, ListChecks, MessageCircle } from 'lucide-react'
import Link from 'next/link'

import Badge from '@/components/ui/badge'
import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import { addDays, fmtDiaMes } from '@/core/advocacia/datas'
import { GRUPOS } from '@/core/advocacia/prioridade'
import { lerFilaDeHoje, type ItemDeHoje } from '@/server/advocacia/fila-de-hoje'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Filtro = 'direcao' | 'meus' | 'equipe'

const ROTULO_DO_FILTRO: Record<Filtro, string> = { direcao: 'Exige direção', meus: 'Meus', equipe: 'Equipe' }

/** Grupos que abrem fechados: esperar alguém de fora não é "o que preciso fazer agora". */
const FECHADOS = new Set([4, 5, 6, 7])

const ICONE = { deadline: CalendarClock, intimation: Gavel, client_action: ListChecks, task: FileText, message: MessageCircle } as const

const ACAO: Record<string, string> = { deadline: 'Abrir', intimation: 'Triar', client_action: 'Abrir', task: 'Abrir', message: 'Cobrar' }

/**
 * "Exige direção" (docs/101 anexo 04 §4.1): sem responsável, prazo fatal atrasado ou de hoje, prazo
 * fatal ainda não confirmado, intimação sem triagem depois do dia. É o que a direção não pode deixar
 * para amanhã, e não um ranking de pessoas.
 */
function exigeDirecao(i: ItemDeHoje, hoje: string): boolean {
  if (i.prioridade.grupo === 0) return true
  const vencido = i.due_on !== null && i.due_on <= hoje
  if (i.source === 'deadline' && i.raw.kind === 'fatal' && (vencido || i.raw.confirmado === false)) return true
  if (i.source === 'intimation' && i.due_on !== null && i.due_on < hoje) return true
  return false
}

type Props = {
  db: SupabaseClient<Database>
  tenantId: string
  timezone: string
  hoje: string
  papel: string
  meuProfissional: string | null
  filtroPedido: string | undefined
}

/**
 * docs/101 T4.4: a tela Hoje do pacote Advocacia. A ordem sai de `prioridade()` (core, a mesma do
 * LUBI); esta tela só filtra e agrupa. Não mostra gráfico, KPI nem "atividade recente": a pergunta é
 * "o que preciso fazer agora?".
 */
export default async function HojeDaAdvocacia({ db, tenantId, hoje, papel, meuProfissional, filtroPedido }: Props) {
  const direcao = papel === 'owner' || papel === 'manager'
  const filtro: Filtro =
    filtroPedido === 'direcao' || filtroPedido === 'meus' || filtroPedido === 'equipe' ? filtroPedido : direcao ? 'direcao' : 'meus'

  const [fila, captura] = await Promise.all([
    lerFilaDeHoje(db, tenantId, hoje),
    // a saúde da captura é da direção (política da 0109): para os outros a leitura volta vazia
    direcao ? db.from('legal_intimation_sync').select('dia, ok').eq('tenant_id', tenantId).order('dia', { ascending: false }).limit(1) : null,
  ])

  const visiveis = fila.filter((i) =>
    filtro === 'equipe' ? true : filtro === 'meus' ? i.owner_staff_id !== null && i.owner_staff_id === meuProfissional : exigeDirecao(i, hoje),
  )
  const grupos = GRUPOS.map((nome, g) => ({ nome, g, itens: visiveis.filter((i) => i.prioridade.grupo === g) })).filter((x) => x.itens.length > 0)

  const ultima = captura?.data?.[0]
  // Captura que não rodou nos últimos 3 dias corridos (cobre o fim de semana) ou que falhou é aviso do sistema.
  const capturaParada = direcao && captura !== null && (!ultima || !ultima.ok || ultima.dia < addDays(hoje, -3))

  const proximoPrazo = fila
    .filter((i) => i.source === 'deadline' && i.due_on !== null && i.due_on >= hoje)
    .sort((a, b) => (a.due_on ?? '').localeCompare(b.due_on ?? ''))[0]

  const link = (f: Filtro) => (f === (direcao ? 'direcao' : 'meus') ? '/admin/hoje' : `/admin/hoje?fila=${f}`)
  const aba = (ativo: boolean) =>
    `inline-flex h-12 items-center rounded-[var(--radius-pill)] px-4 text-secundario font-semibold ${
      ativo ? 'bg-acc text-on-acc' : 'border border-line-2 bg-surface-2 text-txt-2'
    }`

  return (
    <>
      <PageHeader titulo="Hoje" descricao="O que precisa de você agora, na ordem em que deve ser feito." />

      {capturaParada ? (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-warn/40 bg-warn/10 p-3 text-secundario text-txt">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
          <p>
            {ultima ? `Captura de intimações parada desde ${fmtDiaMes(ultima.dia)}.` : 'A captura de intimações ainda não rodou.'} Confira em
            comunica.pje.jus.br.
          </p>
        </div>
      ) : null}

      <nav aria-label="Filtrar a fila" className="mb-4 flex flex-wrap gap-2">
        {(direcao ? (['direcao', 'meus', 'equipe'] as const) : (['meus', 'equipe'] as const)).map((f) => (
          <Link key={f} href={link(f)} aria-current={filtro === f ? 'page' : undefined} className={aba(filtro === f)}>
            {ROTULO_DO_FILTRO[f]}
          </Link>
        ))}
      </nav>

      {grupos.length === 0 ? (
        <Card className="p-4">
          <p className="text-corpo font-semibold">Tudo em dia.</p>
          <p className="text-secundario text-txt-2">
            {proximoPrazo
              ? `Próximo prazo: ${fmtDiaMes(proximoPrazo.due_on!)}${proximoPrazo.casoTitulo ? `, ${proximoPrazo.casoTitulo}` : ''}.`
              : 'Nenhum prazo aberto.'}
          </p>
          {!proximoPrazo ? (
            <Link href="/admin/casos/novo" className="mt-2 inline-flex h-12 items-center font-semibold text-acc-2">
              Comece por um caso
            </Link>
          ) : null}
        </Card>
      ) : (
        <div className="flex flex-col gap-5 pb-8">
          {grupos.map(({ nome, g, itens }) => {
            const lista = (
              <ul className="flex flex-col gap-2">
                {itens.map((i) => (
                  <ItemDaFila key={i.item_key} item={i} />
                ))}
              </ul>
            )
            return (
              <section key={g} aria-label={`${nome}: ${itens.length}`}>
                {FECHADOS.has(g) ? (
                  <details>
                    <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
                      {nome} ({itens.length})
                    </summary>
                    {lista}
                  </details>
                ) : (
                  <>
                    <h2 className={`mb-2 text-overline font-semibold uppercase tracking-[0.13em] ${g <= 1 ? 'text-bad' : 'text-txt-3'}`}>
                      {nome} ({itens.length})
                    </h2>
                    {lista}
                  </>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}

function ItemDaFila({ item }: { item: ItemDeHoje }) {
  const Icone = ICONE[item.source as keyof typeof ICONE] ?? FileText
  const fatal = item.prioridade.selos.includes('fatal')
  const atrasado = item.prioridade.selos.includes('atrasado')
  const conteudo = (
    <Card pressionavel={item.link !== null} className="flex items-start gap-3 p-3">
      <Icone aria-hidden className={`mt-0.5 size-5 shrink-0 ${atrasado ? 'text-bad' : 'text-txt-2'}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-secundario font-semibold ${atrasado ? 'text-bad' : 'text-txt'}`}>{item.prioridade.motivo}</p>
        <p className="text-corpo text-txt">{item.title}</p>
        {item.clienteNome || item.casoTitulo ? (
          <p className="text-label text-txt-3">{[item.clienteNome, item.casoTitulo].filter(Boolean).join(' · ')}</p>
        ) : null}
        {item.source === 'deadline' && item.raw.kind === 'fatal' && item.raw.confirmado === false ? <p className="text-label text-warn">Sugestão a confirmar</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {fatal ? <Badge estado="risk" className="whitespace-nowrap">Fatal</Badge> : null}
        {item.link ? (
          <span className="inline-flex items-center text-secundario font-semibold text-acc-2">
            {ACAO[item.source] ?? 'Abrir'}
            <ChevronRight aria-hidden className="size-4" />
          </span>
        ) : null}
      </div>
    </Card>
  )
  return <li>{item.link ? <Link href={item.link} className="block rounded-[var(--radius-md)]">{conteudo}</Link> : conteudo}</li>
}
