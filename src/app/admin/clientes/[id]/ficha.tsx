'use client'

import {
  CalendarDays,
  Cake,
  FileText,
  Gift,
  MessageCircle,
  Pencil,
  Scissors,
  Share2,
  TriangleAlert,
  UserPlus,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import Avatar from '@/components/ui/avatar'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import IconButton from '@/components/ui/icon-button'
import IconeAnel from '@/components/ui/icone-anel'
import ActionBar from '@/components/ui/action-bar'
import SectionHeader from '@/components/ui/section-header'
import Segmented from '@/components/ui/segmented'
import Sheet from '@/components/ui/sheet'
import StatTile from '@/components/ui/stat-tile'
import { useToast } from '@/components/ui/toast'
import { dinheiro, formatarTelefone } from '@/lib/formato'
import { camposDePreferencia } from '@/lib/preferencias'
import { aplicarVariaveis, linkWhatsApp, precisaDeAgendamento } from '@/lib/mensagens'

import type { FichaCliente } from '@/server/services/crm'
import type { ConfigFidelidade } from '@/server/services/fidelidade'

import Fidelidade from './fidelidade'
import DireitosDaCliente from './direitos'
import Notas from './notas'
import PacotesCarteira from './pacotes-carteira'
import Saude from './saude'

type Modelo = { id: string; title: string; body: string }
type Plano = { id: string; name: string; price_cents: number; sessions_per_month: number | null }
type ProfissionalOpcao = { id: string; name: string }

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

const ABAS_FICHA = [
  { valor: 'resumo', rotulo: 'Resumo' },
  { valor: 'historico', rotulo: 'Histórico' },
  { valor: 'fidelidade', rotulo: 'Fidelidade' },
  { valor: 'ficha', rotulo: 'Ficha' },
]

export default function Ficha({
  ficha,
  modelos,
  nomeDoNegocio,
  vertical,
  planos,
  profissionais,
  configFidelidade,
  podeApagarCliente,
  podeLancarPacote,
  servicos,
  linkIndicacao,
}: {
  ficha: FichaCliente
  modelos: Modelo[]
  nomeDoNegocio: string
  vertical: string
  planos: Plano[]
  profissionais: ProfissionalOpcao[]
  configFidelidade: ConfigFidelidade
  /** `client:delete` é de dono/gerente; recepção não apaga base de cliente. */
  podeApagarCliente: boolean
  /** `comanda:own`: quem não tem nunca veria os sheets funcionarem. */
  podeLancarPacote: boolean
  /** Para vender pacote sem sair da ficha. */
  servicos: { id: string; name: string; priceCents: number }[]
  /** I-5, `docs/30-INDICACAO-PLANO.md` §6.2c: convite assinado desta cliente. `null` só se o tenant não tiver `slug` ainda. */
  linkIndicacao: string | null
}) {
  const router = useRouter()
  const parametros = useSearchParams()
  const mostrarToast = useToast()

  /**
   * A aba nasce da URL (link de ficha aberta em "Histórico" abre em "Histórico") mas vive em
   * estado local. `router.replace` foi tentado primeiro e está errado aqui: a página é
   * `force-dynamic`, então trocar de aba viraria ida ao servidor e um piscar de tela — sendo
   * que o dado das quatro abas já veio junto na primeira carga. Trocar de aba é mudar de
   * camada, não buscar de novo.
   *
   * `history.replaceState` mantém a URL compartilhável e restaurável sem re-renderizar a rota
   * nem empilhar entrada no botão voltar.
   */
  const [aba, setAba] = useState(() => {
    const daUrl = parametros.get('aba')
    return ABAS_FICHA.some((a) => a.valor === daUrl) ? (daUrl as string) : 'resumo'
  })

  function trocarAba(nova: string) {
    setAba(nova)
    const p = new URLSearchParams(window.location.search)
    p.set('aba', nova)
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`)
  }
  const [salvando, iniciarSalvamento] = useTransition()

  const [editando, setEditando] = useState(false)
  const [escolhendoMensagem, setEscolhendoMensagem] = useState(false)
  const [indicando, setIndicando] = useState(false)

  // `notasRegistradas` (o histórico de anotações datadas) e `notas` (o estado local do campo de
  // observação livre no formulário de edição, abaixo) são coisas diferentes — nomes parecidos de
  // propósito porque a ideia é a mesma, só que uma substitui e a outra acumula.
  const { cliente, metricas, ciclo, historico, mensagens, indicadoPor, indicados, notas: notasRegistradas, pontos, assinatura, pacotes, saldoCarteiraCents, fotos, consentimentos, saude } = ficha

  const camposPreferencia = camposDePreferencia(vertical)

  const [nome, setNome] = useState(cliente.name)
  const [telefone, setTelefone] = useState(formatarTelefone(cliente.phoneE164) ?? '')
  const [nascimento, setNascimento] = useState(cliente.birthDate ?? '')
  const [notas, setNotas] = useState(cliente.notes ?? '')
  const [tags, setTags] = useState(cliente.tags.join(', '))
  const [preferencias, setPreferencias] = useState<Record<string, string>>(cliente.preferences)
  const [documento, setDocumento] = useState(cliente.document ?? '')
  const [genero, setGenero] = useState(cliente.gender ?? '')
  const [endereco, setEndereco] = useState(cliente.address ?? '')
  const [contatoEmergencia, setContatoEmergencia] = useState(cliente.emergencyContact ?? '')
  const [profissionalPreferido, setProfissionalPreferido] = useState(cliente.preferredProfessionalId ?? '')
  const [bloqueado, setBloqueado] = useState(cliente.onlineBookingBlocked)
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
      link: linkIndicacao,
    }),
    [cliente.name, proximo, ultimoServico, nomeDoNegocio, metricas.ticketMedioCents, linkIndicacao],
  )

  /**
   * I-5, `docs/30-INDICACAO-PLANO.md` §6.2c: o texto pronto e o link, num único botão que abre o
   * WhatsApp DESTA cliente — é ela quem decide indicar, o dono só está pedindo. Moldura de
   * presente (§2.2): o prêmio de quem indica nunca é o título.
   */
  const textoIndicacao = linkIndicacao
    ? aplicarVariaveis(
        '{{nome}}, adoro te atender! Que tal indicar uma amiga? Ela agenda o primeiro horário por aqui, sem esperar resposta — {{link}}',
        variaveis,
      )
    : ''
  const linkWhatsAppIndicacao = linkIndicacao ? linkWhatsApp(cliente.phoneE164, textoIndicacao) : null

  function salvar() {
    setErro(null)
    iniciarSalvamento(async () => {
      try {
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
            document: documento.trim() || null,
            gender: genero.trim() || null,
            address: endereco.trim() || null,
            emergencyContact: contatoEmergencia.trim() || null,
            preferredProfessionalId: profissionalPreferido || null,
            onlineBookingBlocked: bloqueado,
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
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  const selo = ciclo ? ROTULO_CICLO[ciclo.state] : null
  const preferenciasPreenchidas = Object.entries(cliente.preferences).filter(([, v]) => v.trim() !== '')

  // Folga maior que o padrão: a `ActionBar` desta tela é permanente (não aparece só na seleção,
  // como em "Recuperar"), então o fim da lista precisa passar por baixo dela. `pb-8` deixava a
  // última linha do histórico escondida atrás da barra.
  return (
    <div className="pb-20">
      {/* O voltar mora na Topbar desde o redesenho — dois numa tela só confundem. */}
      <header className="flex items-center gap-3 py-5">
        <Avatar nome={cliente.name} tamanho="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-titulo font-bold">{cliente.name}</h1>
          <p className="text-secundario text-txt-2">
            {formatarTelefone(cliente.phoneE164) ?? 'Sem telefone'}
            {cliente.source ? ` · ${ROTULO_ORIGEM[cliente.source] ?? cliente.source}` : ''}
          </p>
        </div>
        <IconButton onClick={() => setEditando(true)} aria-label="Editar ficha">
          <Pencil aria-hidden className="size-5" />
        </IconButton>
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

      {/*
        Camada 1 — o que a profissional precisa COM O CLIENTE NA CADEIRA. Estava no segundo
        scroll, embaixo de LTV e pontos: a pergunta "como ele gosta do corte?" chegava depois
        da pergunta "quanto ele vale?". Agora abre sem rolar.
      */}
      <section className="mt-1">
        <SectionHeader icone={<IconeAnel className="size-3.5" />}>Como atender</SectionHeader>
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

      {/* Camada 2 — a ficha responde a três perguntas diferentes; cada aba é uma delas. */}
      <Segmented
        segmentos={ABAS_FICHA}
        valor={aba}
        aoTrocar={trocarAba}
        rotulo="Seções da ficha"
        className="mt-6"
      />

      {aba === 'resumo' ? (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile rotulo="Já gastou" valor={dinheiro.format(metricas.ltvCents / 100)} />
            <StatTile rotulo="Visitas" valor={String(metricas.visitas)} />
            <StatTile rotulo="Ticket médio" valor={dinheiro.format(metricas.ticketMedioCents / 100)} />
            <StatTile rotulo="Faltas" valor={String(metricas.faltas)} />
          </div>

          <Button
            variante="secondary"
            largura="cheia"
            className="mt-3"
            onClick={() => router.push(`/admin/orcamentos/novo?cliente=${cliente.id}`)}
          >
            <FileText className="size-4" />
            Criar orçamento
          </Button>

          {linkIndicacao ? (
            <Button
              variante="secondary"
              largura="cheia"
              className="mt-2"
              onClick={() => setIndicando(true)}
              disabled={!cliente.phoneE164}
              motivoDesabilitado="Cadastre o telefone da cliente para poder mandar o convite."
            >
              <Share2 className="size-4" />
              Indicar
            </Button>
          ) : null}

      {(cliente.birthDate || cliente.preferredProfessionalName || indicadoPor || indicados.length > 0) && (
        <section className="mt-7">
          <SectionHeader>Relacionamento</SectionHeader>
          <Card className="grid gap-3">
            {cliente.birthDate ? (
              <div className="flex items-center gap-2.5">
                <Cake className="size-4 shrink-0 text-acc-2" />
                <span className="text-corpo">Aniversário em {aniversario(cliente.birthDate)}</span>
              </div>
            ) : null}
            {cliente.preferredProfessionalName ? (
              <div className="flex items-center gap-2.5">
                <Scissors className="size-4 shrink-0 text-acc-2" />
                <span className="text-corpo">Sempre atende com {cliente.preferredProfessionalName}</span>
              </div>
            ) : null}
            {/* "Indicada"/"Indicado" some: o mesmo app é de barbearia e de manicure, e o texto
                não pode escolher um gênero (Parte II). "Veio por indicação de" resolve sem
                rodeio. */}
            {indicadoPor ? (
              <div className="flex items-center gap-2.5">
                <UserPlus className="size-4 shrink-0 text-acc-2" />
                <span className="text-corpo">
                  Veio por indicação de{' '}
                  <Link
                    href={`/admin/clientes/${indicadoPor.id}`}
                    className="toque-48 inline-flex font-semibold text-acc-2 underline-offset-2 hover:underline"
                  >
                    {indicadoPor.name}
                  </Link>
                </span>
              </div>
            ) : null}
            {indicados.length > 0 ? (
              <div className="flex items-start gap-2.5">
                <Gift className="size-4 shrink-0 translate-y-0.5 text-acc-2" />
                <div className="min-w-0 flex-1">
                  <p className="text-corpo">
                    Já trouxe {indicados.length} {indicados.length === 1 ? 'cliente' : 'clientes'}
                  </p>
                  {/* Eram links separados por vírgula dentro do parágrafo, de 18px cada — alvo
                      impossível no polegar. Viram pastilhas: cada nome ganha área própria. */}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {indicados.map((i) => (
                      <Link
                        key={i.id}
                        href={`/admin/clientes/${i.id}`}
                        className="toque-48 inline-flex h-10 items-center rounded-[var(--radius-pill)] border border-line-2 bg-surface-2 px-3 text-label font-semibold text-txt-2 transition-colors hover:bg-surface-3 hover:text-txt"
                      >
                        {i.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        </section>
      )}

        </div>
      ) : null}

      {aba === 'fidelidade' ? (
        <div className="mt-4">
          <Fidelidade clientId={cliente.id} pontosIniciais={pontos} assinaturaInicial={assinatura} planos={planos} config={configFidelidade} />
          <PacotesCarteira
            clientId={cliente.id}
            pacotes={pacotes}
            saldoCarteiraCents={saldoCarteiraCents}
            servicos={servicos}
            podeLancar={podeLancarPacote}
          />
        </div>
      ) : null}

      {aba === 'ficha' ? (
        <div className="mt-4">
          <Notas clientId={cliente.id} iniciais={notasRegistradas} />
          <Saude clientId={cliente.id} saude={saude} fotos={fotos} consentimentos={consentimentos} />
          <DireitosDaCliente clientId={cliente.id} nome={cliente.name} podeApagar={podeApagarCliente} />
        </div>
      ) : null}

      {aba === 'historico' ? (
        <div className="mt-4">
      <section className="mt-3">
        <SectionHeader icone={<Scissors className="size-3.5" />}>Atendimentos ({historico.length})</SectionHeader>
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
        </div>
      ) : null}

      {/*
        Camada 3 — as duas ações que a pessoa realmente faz nesta tela. Eram botões no meio da
        página, que sumiam no primeiro rolar; agora acompanham qualquer aba.
      */}
      <ActionBar>
        <div className="grid grid-cols-2 gap-2">
          <Button variante="secondary" largura="cheia" onClick={() => router.push(`/admin/agenda/novo?cliente=${cliente.id}`)}>
            <CalendarDays aria-hidden className="size-4" />
            Horário
          </Button>
          <Button largura="cheia" onClick={() => setEscolhendoMensagem(true)}>
            <MessageCircle aria-hidden className="size-4" />
            Mensagem
          </Button>
        </div>
      </ActionBar>

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

      {/* ─── indicar (I-5) ─── */}
      <Sheet aberto={indicando} aoFechar={(a) => !a && setIndicando(false)} titulo="Indicar">
        <div className="flex flex-col gap-3">
          <Card>
            <div className="flex items-start gap-3">
              <Gift aria-hidden className="mt-0.5 size-5 shrink-0 text-acc-2" />
              <p className="text-corpo text-txt">{textoIndicacao}</p>
            </div>
          </Card>
          <a
            href={linkWhatsAppIndicacao ?? '#'}
            target="_blank"
            rel="noreferrer"
            onClick={() => setIndicando(false)}
            className="toque-48 flex items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-acc px-5 text-corpo font-semibold text-on-acc"
          >
            <MessageCircle aria-hidden className="size-4" />
            Mandar no WhatsApp
          </a>
        </div>
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

          <p className="mt-1 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Perfil</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">CPF (opcional)</span>
              <input
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="000.000.000-00"
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">Gênero (opcional)</span>
              <input
                value={genero}
                onChange={(e) => setGenero(e.target.value)}
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Endereço (opcional)</span>
            <input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Contato de emergência (opcional)</span>
            <input
              value={contatoEmergencia}
              onChange={(e) => setContatoEmergencia(e.target.value)}
              placeholder="Nome e telefone"
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
          {profissionais.length > 0 ? (
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">Sempre atende com</span>
              <select
                value={profissionalPreferido}
                onChange={(e) => setProfissionalPreferido(e.target.value)}
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
              >
                <option value="">Sem preferência</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex items-start gap-2 py-1">
            <input
              type="checkbox"
              checked={bloqueado}
              onChange={(e) => setBloqueado(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 rounded border-line-2 bg-surface-2"
            />
            <span className="text-corpo text-txt">
              Bloquear agendamento online
              <span className="block text-secundario text-txt-3">
                Continua sendo atendido normalmente — só não marca sozinho pelo site.
              </span>
            </span>
          </label>

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
