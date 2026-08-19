'use client'

import {
  ArrowLeft,
  CalendarDays,
  Cake,
  Gift,
  MessageCircle,
  Pencil,
  Scissors,
  Sparkles,
  TriangleAlert,
  UserPlus,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'
import Sheet from '@/components/ui/sheet'
import StatTile from '@/components/ui/stat-tile'
import { useToast } from '@/components/ui/toast'
import { dinheiro } from '@/lib/formato'
import { camposDePreferencia } from '@/lib/preferencias'
import { aplicarVariaveis, linkWhatsApp, precisaDeAgendamento } from '@/lib/mensagens'

import type { FichaCliente } from '@/server/services/crm'

type Modelo = { id: string; title: string; body: string }

const ROTULO_CICLO: Record<string, { texto: string; estado: 'ok' | 'warn' | 'risk' | 'bad' }> = {
  on_track: { texto: 'Em dia', estado: 'ok' },
  due: { texto: 'Está na hora de voltar', estado: 'warn' },
  late: { texto: 'Atrasada', estado: 'warn' },
  at_risk: { texto: 'Em risco de perder', estado: 'risk' },
  lost: { texto: 'Perdida', estado: 'bad' },
}

const ROTULO_STATUS: Record<string, string> = {
  done: 'Atendida',
  no_show: 'Faltou',
  canceled: 'Cancelada',
  pending: 'Aguardando',
  confirmed: 'Confirmada',
  arrived: 'Chegou',
}

/** `kind` é enum do banco; sem tradução a tela mostrava "campaign"/"no_show" cru para o dono. */
const ROTULO_MENSAGEM: Record<string, string> = {
  reminder: 'Lembrete',
  confirmation: 'Confirmação',
  cycle: 'Hora de voltar',
  campaign: 'Campanha',
  transactional: 'Aviso',
  review: 'Pedido de avaliação',
}

const ROTULO_ORIGEM: Record<string, string> = {
  indicacao: 'Indicação',
  instagram: 'Instagram',
  google: 'Google',
  passou_na_frente: 'Passou na frente',
}

function formatarTelefone(e164: string | null): string | null {
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164 ?? '')
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

function dataCurta(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** "12 de março" — aniversário não precisa do ano, e mostrar a idade é um vexame desnecessário. */
function aniversario(iso: string | null): string | null {
  if (!iso) return null
  const [, mes, dia] = iso.split('-')
  return new Date(2000, Number(mes) - 1, Number(dia)).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

export default function Ficha({
  ficha,
  modelos,
  nomeDoNegocio,
  vertical,
}: {
  ficha: FichaCliente
  modelos: Modelo[]
  nomeDoNegocio: string
  vertical: string
}) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [salvando, iniciarSalvamento] = useTransition()

  const [editando, setEditando] = useState(false)
  const [escolhendoMensagem, setEscolhendoMensagem] = useState(false)

  const { cliente, metricas, ciclo, historico, mensagens, indicadoPor, indicados } = ficha

  const camposPreferencia = camposDePreferencia(vertical)

  const [nome, setNome] = useState(cliente.name)
  const [telefone, setTelefone] = useState(formatarTelefone(cliente.phoneE164) ?? '')
  const [nascimento, setNascimento] = useState(cliente.birthDate ?? '')
  const [notas, setNotas] = useState(cliente.notes ?? '')
  const [tags, setTags] = useState(cliente.tags.join(', '))
  const [preferencias, setPreferencias] = useState<Record<string, string>>(cliente.preferences)
  const [erro, setErro] = useState<string | null>(null)

  const ultimoServico = historico.find((h) => h.status === 'done')?.serviceName ?? null

  /**
   * O horário marcado que ainda vem. É ele que preenche `{{data}}`/`{{hora}}` de confirmação e
   * lembrete — sem ele o texto sairia "no dia às ." na cara do cliente, então os modelos que
   * dependem disso ficam bloqueados com o motivo à vista, em vez de mandarem frase quebrada.
   */
  const proximo = useMemo(() => {
    const agora = Date.now()
    return (
      [...historico]
        .filter((h) => ['pending', 'confirmed', 'arrived'].includes(h.status) && new Date(h.startsAt).getTime() > agora)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null
    )
  }, [historico])

  /** Variáveis do modelo montadas do jeito que o cliente vai ler — a prévia é o texto real. */
  const variaveis = useMemo(
    () => ({
      nome: cliente.name,
      servico: proximo?.serviceName ?? ultimoServico,
      negocio: nomeDoNegocio,
      valor: metricas.ticketMedioCents > 0 ? dinheiro.format(metricas.ticketMedioCents / 100) : null,
      data: proximo ? new Date(proximo.startsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null,
      hora: proximo
        ? new Date(proximo.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : null,
    }),
    [cliente.name, proximo, ultimoServico, nomeDoNegocio, metricas.ticketMedioCents],
  )

  function salvar() {
    setErro(null)
    iniciarSalvamento(async () => {
      const r = await fetch(`/api/v1/clients/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          name: nome,
          phone: telefone.trim() || null,
          birthDate: nascimento || null,
          notes: notas.trim() || null,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          // Campo em branco sai do objeto: preferência vazia é ruído na tela de quem atende.
          preferences: Object.fromEntries(Object.entries(preferencias).filter(([, v]) => v.trim() !== '')),
        }),
      })
      const json = (await r.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
      if (!r.ok) {
        const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(campo ?? json.error?.message ?? 'Não consegui salvar.')
        return
      }
      mostrarToast({ tom: 'ok', titulo: 'Ficha atualizada' })
      setEditando(false)
      router.refresh()
    })
  }

  const selo = ciclo ? ROTULO_CICLO[ciclo.state] : null
  const preferenciasPreenchidas = Object.entries(cliente.preferences).filter(([, v]) => v.trim() !== '')

  return (
    <div className="pb-8">
      <header className="flex items-center gap-2 py-5">
        <Link
          href="/admin/clientes"
          aria-label="Voltar para a lista"
          className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-sm)] text-txt-2 transition-colors hover:bg-surface-2 hover:text-txt"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-titulo font-extrabold">{cliente.name}</h1>
          <p className="text-secundario text-txt-2">
            {formatarTelefone(cliente.phoneE164) ?? 'Sem telefone'}
            {cliente.source ? ` · ${ROTULO_ORIGEM[cliente.source] ?? cliente.source}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando(true)}
          aria-label="Editar ficha"
          className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-sm)] text-txt-2 transition-colors hover:bg-surface-2 hover:text-txt"
        >
          <Pencil className="size-5" />
        </button>
      </header>

      {cliente.tags.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {/* `Chip` é botão (filtro); aqui a etiqueta só informa, então é `span` — nada de alvo de toque que não faz nada. */}
          {cliente.tags.map((t) => (
            <span
              key={t}
              className="inline-flex h-8 items-center rounded-[var(--radius-pill)] border border-line-2 bg-surface-2 px-3.5 text-label font-semibold text-txt-2"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {/* O alerta que faz a pessoa agir: quem está atrasada aparece antes de qualquer número. */}
      {selo && ciclo && ciclo.state !== 'on_track' ? (
        <Card className="mb-4 flex items-center gap-3 border-warn/30 bg-warn/5">
          <TriangleAlert className="size-5 shrink-0 text-warn" />
          <div className="min-w-0 flex-1">
            <p className="text-corpo font-semibold">
              {selo.texto}
              {ciclo.lateDays > 0 ? ` há ${ciclo.lateDays} dias` : ''}
            </p>
            <p className="text-secundario text-txt-2">Costuma voltar para {ciclo.serviceName}.</p>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <StatTile rotulo="Já gastou" valor={dinheiro.format(metricas.ltvCents / 100)} />
        <StatTile rotulo="Visitas" valor={String(metricas.visitas)} />
        <StatTile rotulo="Ticket médio" valor={dinheiro.format(metricas.ticketMedioCents / 100)} />
        <StatTile rotulo="Faltas" valor={String(metricas.faltas)} />
      </div>

      <div className="mt-4 grid gap-2">
        <Button largura="cheia" onClick={() => setEscolhendoMensagem(true)}>
          <MessageCircle className="size-4" />
          Mandar mensagem pronta
        </Button>
        <Button variante="secondary" largura="cheia" onClick={() => router.push(`/admin/agenda/novo?cliente=${cliente.id}`)}>
          <CalendarDays className="size-4" />
          Marcar horário
        </Button>
      </div>

      {/* Preferências: o "caderninho" que faz a cliente se sentir conhecida. */}
      <section className="mt-7">
        <SectionHeader icone={<Sparkles className="size-3.5" />}>Como atender</SectionHeader>
        <Card>
          {preferenciasPreenchidas.length === 0 ? (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="w-full text-left text-secundario text-txt-3 transition-colors hover:text-txt-2"
            >
              Nada anotado ainda. Toque para registrar as preferências de atendimento.
            </button>
          ) : (
            <dl className="grid gap-2.5">
              {preferenciasPreenchidas.map(([chave, valor]) => {
                const campo = camposPreferencia.find((c) => c.chave === chave)
                return (
                  <div key={chave} className="flex gap-3">
                    <dt className="w-32 shrink-0 text-secundario text-txt-3">{campo?.rotulo ?? chave}</dt>
                    <dd className="min-w-0 flex-1 text-corpo text-txt">{valor}</dd>
                  </div>
                )
              })}
            </dl>
          )}
        </Card>

        {cliente.notes ? (
          <Card className="mt-3">
            <p className="text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Observações</p>
            <p className="mt-1.5 whitespace-pre-wrap text-corpo text-txt">{cliente.notes}</p>
          </Card>
        ) : null}
      </section>

      {(cliente.birthDate || indicadoPor || indicados.length > 0) && (
        <section className="mt-7">
          <SectionHeader>Relacionamento</SectionHeader>
          <Card className="grid gap-3">
            {cliente.birthDate ? (
              <div className="flex items-center gap-2.5">
                <Cake className="size-4 shrink-0 text-acc-2" />
                <span className="text-corpo">Aniversário em {aniversario(cliente.birthDate)}</span>
              </div>
            ) : null}
            {indicadoPor ? (
              <div className="flex items-center gap-2.5">
                <UserPlus className="size-4 shrink-0 text-acc-2" />
                <span className="text-corpo">
                  Indicada por{' '}
                  <Link href={`/admin/clientes/${indicadoPor.id}`} className="font-semibold text-acc-2 underline-offset-2 hover:underline">
                    {indicadoPor.name}
                  </Link>
                </span>
              </div>
            ) : null}
            {indicados.length > 0 ? (
              <div className="flex items-start gap-2.5">
                <Gift className="size-4 shrink-0 translate-y-0.5 text-acc-2" />
                <span className="text-corpo">
                  Já trouxe {indicados.length} {indicados.length === 1 ? 'cliente' : 'clientes'}:{' '}
                  {indicados.map((i, idx) => (
                    <span key={i.id}>
                      {idx > 0 ? ', ' : ''}
                      <Link href={`/admin/clientes/${i.id}`} className="font-semibold text-acc-2 underline-offset-2 hover:underline">
                        {i.name}
                      </Link>
                    </span>
                  ))}
                </span>
              </div>
            ) : null}
          </Card>
        </section>
      )}

      <section className="mt-7">
        <SectionHeader icone={<Scissors className="size-3.5" />}>Histórico ({historico.length})</SectionHeader>
        {historico.length === 0 ? (
          <Card>
            <p className="text-secundario text-txt-3">Ainda não veio nenhuma vez.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-line p-0">
            {historico.slice(0, 12).map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-corpo font-semibold">{h.serviceName}</p>
                  <p className="text-secundario text-txt-3">
                    {dataCurta(h.startsAt)} · {h.professionalName}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-corpo">{dinheiro.format(h.priceCents / 100)}</p>
                  {h.status !== 'done' ? (
                    <p className={h.status === 'no_show' ? 'text-label text-bad' : 'text-label text-txt-3'}>
                      {ROTULO_STATUS[h.status] ?? h.status}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {mensagens.length > 0 ? (
        <section className="mt-7">
          <SectionHeader>Mensagens enviadas</SectionHeader>
          <Card className="divide-y divide-line p-0">
            {mensagens.slice(0, 6).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="truncate text-corpo">{ROTULO_MENSAGEM[m.kind] ?? m.kind}</span>
                <span className="shrink-0 text-secundario text-txt-3">{dataCurta(m.createdAt)}</span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {/* ─── escolher mensagem pronta ─── */}
      <Sheet aberto={escolhendoMensagem} aoFechar={(a) => !a && setEscolhendoMensagem(false)} titulo="Mensagem pronta">
        {cliente.whatsappOptOut ? (
          <p className="text-corpo text-bad">
            Pediu para não receber mensagens. Respeite o pedido.
          </p>
        ) : !cliente.phoneE164 ? (
          <p className="text-corpo text-txt-2">Sem telefone cadastrado. Toque no lápis para adicionar.</p>
        ) : (
          <div className="grid gap-2">
            {modelos.map((m) => {
              // Sem horário marcado, o modelo de confirmação/lembrete sairia com buraco no
              // lugar da data — melhor bloquear e dizer o porquê do que mandar frase quebrada.
              const bloqueado = precisaDeAgendamento(m.body) && !proximo
              if (bloqueado) {
                return (
                  <div
                    key={m.id}
                    className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 p-3 opacity-50"
                    title="Precisa de um horário marcado"
                  >
                    <p className="text-corpo font-semibold text-txt">{m.title}</p>
                    <p className="mt-1 text-secundario text-txt-3">Precisa de um horário marcado.</p>
                  </div>
                )
              }

              const texto = aplicarVariaveis(m.body, variaveis)
              const link = linkWhatsApp(cliente.phoneE164, texto)
              return (
                <a
                  key={m.id}
                  href={link ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setEscolhendoMensagem(false)}
                  className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 p-3 text-left transition-colors hover:border-acc/40 hover:bg-surface-3"
                >
                  <p className="text-corpo font-semibold text-txt">{m.title}</p>
                  <p className="mt-1 line-clamp-3 text-secundario text-txt-2">{texto}</p>
                </a>
              )
            })}
            <Link href="/admin/config/mensagens" className="mt-1 text-center text-secundario text-txt-3 hover:text-txt-2">
              Editar meus modelos
            </Link>
          </div>
        )}
      </Sheet>

      {/* ─── editar ficha ─── */}
      <Sheet aberto={editando} aoFechar={(a) => !a && setEditando(false)} titulo="Editar ficha">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">Telefone</span>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                inputMode="tel"
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">Aniversário</span>
              <input
                type="date"
                value={nascimento}
                onChange={(e) => setNascimento(e.target.value)}
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
              />
            </label>
          </div>

          <p className="mt-1 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Como atender</p>
          {camposPreferencia.map((campo) => (
            <label key={campo.chave} className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">{campo.rotulo}</span>
              <input
                value={preferencias[campo.chave] ?? ''}
                placeholder={campo.dica}
                onChange={(e) => setPreferencias((p) => ({ ...p, [campo.chave]: e.target.value }))}
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
              />
            </label>
          ))}

          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Etiquetas (separadas por vírgula)</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="fiel, vip"
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Observações</span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 py-2 text-corpo text-txt"
            />
          </label>

          {erro ? (
            <p role="alert" className="text-secundario text-bad">
              {erro}
            </p>
          ) : null}

          <Button largura="cheia" carregando={salvando} onClick={salvar}>
            Salvar
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
