'use client'

import { GripHorizontal, Sparkles, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Fragment, useEffect, useRef, useState } from 'react'

import Card from '@/components/ui/card'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

type Sugestao = {
  rotulo: string
  pergunta: string
  /**
   * 2026-08-30: quando presente, o clique NÃO passa pelo Gemini — vai para
   * `POST /api/v1/assistant/rapido` com este id, que devolve uma resposta 100% determinística
   * (o mesmo dado que a tela já mostra, só em frase). Latência medida do caminho com LLM: 2-8s;
   * deste caminho: consulta única ao banco, sem chamada externa. Reserve para sugestão cuja
   * resposta é sempre a mesma pergunta feita da mesma forma — mudou o texto do botão, muda o id
   * em `respostas-rapidas.ts` também, os dois têm que casar.
   */
  idRapido?: string
}

/**
 * docs/26-AGENTE-IA-PLANO.md §5 — sugestões por tela, nunca caixa vazia: dono de salão não sabe o
 * que perguntar para um sistema, e é a defesa principal contra "ninguém vai usar" (§9 red team).
 * Chave é o prefixo da rota; a primeira que casar com `pathname.startsWith(...)` vence.
 */
const SUGESTOES_POR_ROTA: { prefixo: string; sugestoes: Sugestao[] }[] = [
  {
    prefixo: '/admin/hoje',
    sugestoes: [
      { rotulo: 'Quem falta confirmar hoje?', pergunta: 'Quem falta confirmar hoje?', idRapido: 'hoje_confirmar' },
      { rotulo: 'Quanto já faturei hoje?', pergunta: 'Quanto eu já faturei hoje?', idRapido: 'hoje_faturamento' },
      { rotulo: 'Tenho horário vago amanhã?', pergunta: 'Eu tenho horário vago amanhã?', idRapido: 'hoje_horario_vago_amanha' },
    ],
  },
  {
    prefixo: '/admin/recuperar',
    sugestoes: [
      { rotulo: 'Quem eu chamo primeiro?', pergunta: 'De quem eu deveria chamar primeiro para recuperar?', idRapido: 'recuperar_quem_primeiro' },
      { rotulo: 'Quanto tem parado aqui?', pergunta: 'Quanto de receita está parado, esperando eu chamar de volta?', idRapido: 'recuperar_total_parado' },
      { rotulo: 'Quem sumiu há mais de 60 dias?', pergunta: 'Quais clientes estão sumidas há mais de 60 dias?', idRapido: 'recuperar_sumidos_60' },
    ],
  },
  {
    prefixo: '/admin/caixa',
    sugestoes: [
      // 2026-08-30: rótulo dizia "essa semana" mas a pergunta sempre foi mês corrente — corrigido
      // para bater (achado ao escrever o template fixo: a resposta ia contradizer o botão).
      { rotulo: 'Quanto faturei este mês?', pergunta: 'Quanto eu faturei neste mês até agora?', idRapido: 'caixa_faturamento_mes' },
      { rotulo: 'Qual foi meu lucro no mês?', pergunta: 'Qual foi meu lucro neste mês?', idRapido: 'caixa_lucro_mes' },
    ],
  },
  {
    prefixo: '/admin/orcamentos',
    sugestoes: [
      { rotulo: 'Quais orçamentos estão sem resposta?', pergunta: 'Quais orçamentos estão parados, sem resposta da cliente?', idRapido: 'orcamentos_sem_resposta' },
    ],
  },
]

const SUGESTOES_PADRAO: Sugestao[] = [
  { rotulo: 'O que fazer hoje?', pergunta: 'O que eu deveria fazer hoje no meu negócio?' },
  { rotulo: 'Quem eu chamo primeiro?', pergunta: 'De quem eu deveria chamar primeiro para recuperar?' },
]

function sugestoesPara(pathname: string): Sugestao[] {
  return SUGESTOES_POR_ROTA.find((s) => pathname.startsWith(s.prefixo))?.sugestoes ?? SUGESTOES_PADRAO
}

type Proposta = { acao: string; dados: Record<string, unknown>; resumo: Record<string, unknown> }
type RespostaOk = { resposta: string; ferramentasUsadas: string[]; proposta?: Proposta }
type Turno = {
  pergunta: string
  resposta: string
  carregando?: boolean
  proposta?: Proposta
  /** Vira `feito` depois do clique — o cartão não pode oferecer o mesmo botão duas vezes. */
  estadoDaProposta?: 'pendente' | 'executando' | 'feito' | 'erro'
  erroDaProposta?: string
}

/** Onde cada ação preparada é de fato executada. O assistente NUNCA chama estas rotas. */
const ROTA_DA_ACAO: Record<string, string> = {
  criar_agendamento: '/api/v1/appointments',
}

function formatarQuando(iso: string): string {
  // `2026-08-31T15:00` → "31/08 às 15:00". Sem `new Date()`: a string já vem no fuso do salão, e
  // deixar o navegador interpretá-la reintroduziria o bug de fuso que o `docs/28` já pagou.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]} às ${m[4]}:${m[5]}` : iso
}

function dinheiroBR(cents: unknown): string | null {
  return typeof cents === 'number' ? (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null
}

// Mesmo ponto de corte que `tab-bar.tsx` usa para trocar de barra inferior para lateral — a casa
// já decidiu que 1024px é "desktop de verdade" aqui. Abaixo disso a janela continua sendo a folha
// que sobe do fundo (`Sheet`): arrastar uma janela pela tela não faz sentido numa largura de
// 390px onde ela já ocupa quase tudo, e brigaria com o gesto de rolar a página.
const CORTE_DESKTOP_PX = 1024

/** Tamanho da janela flutuante no desktop — grande o bastante para ler, pequeno o bastante para não tapar a tela toda. */
const LARGURA_JANELA = 400
const ALTURA_MAX_JANELA = 600
const MARGEM_TELA = 16

function useEhDesktop(): boolean {
  const [ehDesktop, setEhDesktop] = useState(false)

  useEffect(() => {
    const consulta = window.matchMedia(`(min-width: ${CORTE_DESKTOP_PX}px)`)
    setEhDesktop(consulta.matches)
    const ouvir = (e: MediaQueryListEvent) => setEhDesktop(e.matches)
    consulta.addEventListener('change', ouvir)
    return () => consulta.removeEventListener('change', ouvir)
  }, [])

  return ehDesktop
}

type Posicao = { x: number; y: number }

/** Canto inferior direito, perto do botão que abre a janela — mesma lógica de ancoragem do botão flutuante. */
function posicaoPadrao(): Posicao {
  return {
    // "- 80": espaço aproximado do botão flutuante (56px) + folga, só para a janela não nascer
    // por cima do próprio botão que a abriu. É só o ponto de partida — quem trava de verdade
    // dentro da tela, com a altura REAL da janela (que muda com o conteúdo), é `limitarNaTela`.
    x: window.innerWidth - LARGURA_JANELA - MARGEM_TELA,
    y: window.innerHeight - ALTURA_MAX_JANELA - MARGEM_TELA - 80,
  }
}

/**
 * 2026-08-30, achado testando o arrasto até o canto: a versão anterior travava o eixo Y contra
 * um número fixo (o mesmo "- 80" do ponto de partida) em vez da altura REAL da janela — content
 * curto (367px) arrastado até o fundo da tela deixava o rodapé 271px para fora do viewport. A
 * altura muda (poucas sugestões vs. conversa longa até `ALTURA_MAX_JANELA`), então o limite tem
 * que perguntar a altura de verdade, não presumir uma.
 */
function limitarNaTela(pos: Posicao, alturaReal: number): Posicao {
  return {
    x: Math.min(Math.max(pos.x, MARGEM_TELA), Math.max(MARGEM_TELA, window.innerWidth - LARGURA_JANELA - MARGEM_TELA)),
    y: Math.min(Math.max(pos.y, MARGEM_TELA), Math.max(MARGEM_TELA, window.innerHeight - alturaReal - MARGEM_TELA)),
  }
}

/** `**negrito**` vira `<strong>` — o único destaque inline que o Gemini usa nas respostas medidas. */
function renderInline(texto: string): React.ReactNode {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g)
  return partes.map((parte, i) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(parte)
    return m ? <strong key={i}>{m[1]}</strong> : <Fragment key={i}>{parte}</Fragment>
  })
}

/**
 * 2026-08-30: o Gemini responde em Markdown de verdade (negrito, listas numeradas, sub-itens
 * com `- `) — medido direto na API, não suposição. Mostrar isso como `<span>` de texto puro
 * deixava `**` literal na tela, o tipo de "feio" que não é gosto, é bug de renderização. Este
 * parser cobre só o que foi medido nas respostas reais (negrito + lista de um ou dois níveis) —
 * de propósito não é um Markdown completo: mais que isso e a resposta do assistente vira HTML
 * arbitrário para desenhar, complexidade que este produto não precisa.
 */
function renderMarkdownLeve(texto: string): React.ReactNode {
  const blocos = texto.split(/\n{2,}/)

  return blocos.map((bloco, i) => {
    const linhas = bloco.split('\n').filter((l) => l.trim().length > 0)
    const ehBlocoDeLista = linhas.length > 0 && linhas.every((l) => /^\s*(\d+\.|[-*])\s/.test(l))

    if (ehBlocoDeLista) {
      return (
        <div key={i} className="flex flex-col gap-1">
          {linhas.map((linha, j) => {
            const m = /^(\s*)(\d+\.|[-*])\s+(.*)$/.exec(linha)
            if (!m) return null
            const indentacao = m[1] ?? ''
            const marcadorBruto = m[2] ?? ''
            const texto = m[3] ?? ''
            const aninhada = indentacao.length >= 2
            const marcador = marcadorBruto === '-' || marcadorBruto === '*' ? '•' : marcadorBruto
            return (
              <div key={j} className={cn('flex gap-2', aninhada && 'pl-5 text-secundario text-txt-2')}>
                <span className="shrink-0 text-txt-3">{marcador}</span>
                <span>{renderInline(texto)}</span>
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <p key={i}>
        {bloco.split('\n').map((linha, j, arr) => (
          <Fragment key={j}>
            {renderInline(linha)}
            {j < arr.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </p>
    )
  })
}

/** Três pontos com "respiro" defasado — o "digitando…" que os grandes usam em vez de texto de status. */
function PontosDigitando() {
  return (
    <div className="flex items-center gap-1 py-1.5" aria-label="Consultando" role="status">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-bounce rounded-full bg-txt-3" style={{ animationDelay: `${i * 140}ms` }} />
      ))}
    </div>
  )
}

const ALTURA_MAX_CAMPO_PX = 128

function ajustarAlturaDoCampo(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, ALTURA_MAX_CAMPO_PX)}px`
}

/**
 * docs/26-AGENTE-IA-PLANO.md §5/§6 (A7) — painel do assistente, presente em toda tela do `/admin`.
 * `disponivel` vem do layout (server component, `Boolean(process.env.GEMINI_API_KEY)`, sem I/O) —
 * sem credencial, este componente nem monta o botão (§4.4: nunca degradar em silêncio, nunca
 * aparecer para depois falhar).
 *
 * 2026-08-30: no desktop (≥1024px) virou janela flutuante que se arrasta pela tela — pedido do
 * Eduardo comparando com o padrão dos grandes (Intercom, Drift, ChatGPT): uma janela que fica por
 * cima do que você está fazendo, não modal que trava a tela. Por isso NÃO usa Radix `Dialog`
 * aqui: dialog é modal por natureza (foca, trava scroll, clique fora fecha) — o oposto do que uma
 * janela flutuante persistente precisa ser. No mobile continua sendo o `Sheet` de sempre, modal e
 * de baixo para cima, que já é o padrão certo numa tela pequena.
 *
 * Mesma data, segunda rodada — visual de conversa: pergunta em bolha à direita, resposta com
 * ícone à esquerda (sem caixa pesada, texto flui como nos grandes players), Markdown renderizado
 * de verdade, "digitando…" animado em vez de texto de status, campo que cresce com o texto,
 * Enter envia / Shift+Enter quebra linha, rolagem automática para a mensagem mais nova.
 */
export default function AssistenteFlutuante({ disponivel }: { disponivel: boolean }) {
  const pathname = usePathname()
  const mostrarToast = useToast()
  const ehDesktop = useEhDesktop()
  const [aberto, setAberto] = useState(false)
  const [pergunta, setPergunta] = useState('')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [indisponivel, setIndisponivel] = useState(false)
  const [posicao, setPosicao] = useState<Posicao | null>(null)
  const arrastandoRef = useRef<{ offsetX: number; offsetY: number } | null>(null)
  const janelaRef = useRef<HTMLDivElement>(null)
  const campoRef = useRef<HTMLTextAreaElement>(null)
  const fimDaListaRef = useRef<HTMLDivElement>(null)

  // Reancorar dentro da tela quando a janela do navegador muda de tamanho — sem isto, redimensionar
  // depois de arrastar para a borda deixa a janela flutuante presa fora da área visível.
  useEffect(() => {
    if (!ehDesktop) return
    function reancorar() {
      const altura = janelaRef.current?.getBoundingClientRect().height ?? ALTURA_MAX_JANELA
      setPosicao((atual) => (atual ? limitarNaTela(atual, altura) : atual))
    }
    window.addEventListener('resize', reancorar)
    return () => window.removeEventListener('resize', reancorar)
  }, [ehDesktop])

  useEffect(() => {
    if (!aberto || !ehDesktop) return

    function mover(e: PointerEvent) {
      if (!arrastandoRef.current) return
      const altura = janelaRef.current?.getBoundingClientRect().height ?? ALTURA_MAX_JANELA
      setPosicao(limitarNaTela({ x: e.clientX - arrastandoRef.current.offsetX, y: e.clientY - arrastandoRef.current.offsetY }, altura))
    }
    function soltar() {
      arrastandoRef.current = null
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
  }, [aberto, ehDesktop])

  // Fechar com Esc — único jeito de fechar sem um X visível no `Sheet` mobile; a janela
  // flutuante do desktop tem um X próprio (não é modal, clique fora não fecha de propósito).
  useEffect(() => {
    if (!aberto) return
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  // Rolar para a mensagem mais nova — sem isto, uma conversa que passa da altura da janela deixa
  // a resposta que acabou de chegar fora de vista, escondida acima da dobra.
  useEffect(() => {
    if (turnos.length === 0) return
    fimDaListaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turnos, aberto])

  if (!disponivel) return null

  function abrir() {
    if (ehDesktop && !posicao) setPosicao(posicaoPadrao())
    setAberto(true)
  }

  // 2026-08-30, achado testando com mouse de verdade (não só evento sintético): arrastar só
  // funcionava pegando exatamente a faixa fina do cabeçalho — testado ao vivo, tentar puxar pelo
  // corpo da janela (onde ficam as sugestões e o campo) não movia nada, e é o lugar mais óbvio
  // pra alguém tentar primeiro. Agora o clique-e-arraste funciona em QUALQUER parte não
  // interativa da janela (não em cima de botão, campo, link) — só ignora onde já existe uma ação
  // de clique, pra não brigar com "tocar numa sugestão" ou "escrever no campo".
  function iniciarArrasto(e: React.PointerEvent) {
    const alvo = e.target as HTMLElement
    if (alvo.closest('button, input, textarea, a, select')) return
    const janela = janelaRef.current
    if (!janela) return
    arrastandoRef.current = { offsetX: e.clientX - janela.getBoundingClientRect().left, offsetY: e.clientY - janela.getBoundingClientRect().top }
  }

  async function perguntar(texto: string, idRapido?: string) {
    const limpo = texto.trim()
    if (!limpo || turnos.some((t) => t.carregando)) return

    setPergunta('')
    if (campoRef.current) campoRef.current.style.height = 'auto'
    setTurnos((atual) => [...atual, { pergunta: limpo, resposta: '', carregando: true }])

    try {
      // Sugestão com `idRapido`: pula o Gemini, vai direto para a resposta determinística —
      // ver o comentário em `Sugestao.idRapido` acima. Texto livre digitado nunca tem id, então
      // sempre cai no caminho normal.
      const r = idRapido
        ? await fetch('/api/v1/assistant/rapido', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: idRapido }),
          })
        : await fetch('/api/v1/assistant', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ pergunta: limpo }),
          })

      if (r.status === 403 || r.status === 503) {
        // Módulo desligado pelo dono, ou provedor fora do ar depois do botão já ter aparecido —
        // aqui sim é degradação visível, não silenciosa: some o resto do painel, avisa por quê.
        setIndisponivel(true)
        setTurnos((atual) => atual.slice(0, -1))
        return
      }
      if (!r.ok) {
        setTurnos((atual) => atual.map((t, i) => (i === atual.length - 1 ? { ...t, resposta: 'Não consegui responder agora.', carregando: false } : t)))
        return
      }

      const corpo = (await r.json()) as { data: RespostaOk }
      setTurnos((atual) =>
        atual.map((t, i) =>
          i === atual.length - 1
            ? {
                ...t,
                resposta: corpo.data.resposta,
                carregando: false,
                proposta: corpo.data.proposta,
                estadoDaProposta: corpo.data.proposta ? ('pendente' as const) : undefined,
              }
            : t,
        ),
      )
    } catch {
      setTurnos((atual) => atual.map((t, i) => (i === atual.length - 1 ? { ...t, resposta: 'Não consegui responder agora.', carregando: false } : t)))
      mostrarToast({ tom: 'erro', titulo: 'Sem conexão com o assistente' })
    }
  }

  /**
   * O clique que executa. A proposta trouxe o corpo pronto; aqui ele vai para a ROTA NORMAL de
   * criação — a mesma que a tela de "Novo agendamento" usa, com a mesma validação, RLS,
   * idempotência e trava de horário sobreposto. O assistente preparou; quem executa é o dono.
   */
  async function confirmarProposta(indice: number) {
    const turno = turnos[indice]
    const proposta = turno?.proposta
    if (!proposta || turno.estadoDaProposta !== 'pendente') return

    const rota = ROTA_DA_ACAO[proposta.acao]
    if (!rota) {
      // Ação que a tela não sabe executar não vira botão quebrado: some o botão e diz o porquê.
      setTurnos((a) => a.map((t, i) => (i === indice ? { ...t, estadoDaProposta: 'erro', erroDaProposta: 'Essa ação ainda não pode ser feita por aqui.' } : t)))
      return
    }

    setTurnos((a) => a.map((t, i) => (i === indice ? { ...t, estadoDaProposta: 'executando' } : t)))

    try {
      const r = await fetch(rota, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify(proposta.dados),
      })
      if (!r.ok) {
        const json = (await r.json().catch(() => null)) as { error?: { message?: string } } | null
        setTurnos((a) =>
          a.map((t, i) =>
            i === indice ? { ...t, estadoDaProposta: 'erro', erroDaProposta: json?.error?.message ?? 'Não deu para fazer agora.' } : t,
          ),
        )
        return
      }
      setTurnos((a) => a.map((t, i) => (i === indice ? { ...t, estadoDaProposta: 'feito' } : t)))
      mostrarToast({ tom: 'ok', titulo: 'Horário marcado' })
    } catch {
      setTurnos((a) =>
        a.map((t, i) => (i === indice ? { ...t, estadoDaProposta: 'erro', erroDaProposta: 'Sem conexão agora. Nada foi marcado.' } : t)),
      )
    }
  }

  const conteudo = (
    <div className="flex flex-col gap-4">
      {indisponivel ? (
        <Card className="border-warn/40 text-secundario text-txt-2">O assistente está indisponível agora. Tente de novo mais tarde.</Card>
      ) : (
        <>
          {turnos.length === 0 ? (
            <div className="flex flex-col gap-2">
              {sugestoesPara(pathname).map((s) => (
                <button
                  key={s.rotulo}
                  type="button"
                  onClick={() => perguntar(s.pergunta, s.idRapido)}
                  className="rounded-[var(--radius-sm)] border border-line px-4 py-3 text-left text-corpo text-txt-2 transition hover:border-line-2 hover:bg-surface-2 active:scale-[.99]"
                >
                  {s.rotulo}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {turnos.map((t, i) => (
                <div key={i} className="flex flex-col gap-3">
                  <div className="ml-auto max-w-[85%] rounded-[var(--radius-sm)] bg-acc-soft px-4 py-2.5 text-corpo text-txt">{t.pergunta}</div>
                  <div className="flex gap-2.5">
                    <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-acc text-on-acc">
                      <Sparkles aria-hidden className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 text-corpo text-txt [&_p:not(:last-child)]:mb-2 [&_div:not(:last-child)]:mb-2">
                      {t.carregando ? <PontosDigitando /> : renderMarkdownLeve(t.resposta)}
                      {/*
                        O cartão de confirmação: é o que separa "assistente que sugere" de
                        "assistente que opera". Mostra o que VAI acontecer em português, com nome
                        de gente e preço — nunca id nem JSON. A pesquisa da Anthropic sobre fadiga
                        de aprovação é explícita: confirmação que a pessoa não consegue julgar
                        vira clique automático, e aí não protege ninguém.
                      */}
                      {t.proposta && !t.carregando ? (
                        <div className="mt-3 rounded-[var(--radius-sm)] border border-acc-2/40 bg-acc-soft/40 p-3">
                          <dl className="grid gap-1">
                            {[
                              ['Cliente', t.proposta.resumo.cliente],
                              // Só aparece quando a cliente ainda não existe: o toque vai
                              // cadastrar E marcar, e o cartão tem que dizer as duas coisas.
                              ['Cadastrar nova', t.proposta.resumo.clienteNova],
                              ['Serviço', t.proposta.resumo.servico],
                              ['Com', t.proposta.resumo.profissional],
                              ['Quando', typeof t.proposta.resumo.quando === 'string' ? formatarQuando(t.proposta.resumo.quando) : null],
                              ['Valor', dinheiroBR(t.proposta.resumo.precoCents)],
                            ]
                              .filter((par): par is [string, string] => typeof par[1] === 'string' && par[1] !== '')
                              .map(([rotulo, valor]) => (
                                <div key={String(rotulo)} className="flex justify-between gap-3">
                                  <dt className="text-secundario text-txt-3">{rotulo}</dt>
                                  <dd className="text-right text-secundario font-semibold text-txt">{String(valor)}</dd>
                                </div>
                              ))}
                          </dl>

                          {t.estadoDaProposta === 'feito' ? (
                            <p className="mt-2.5 text-secundario font-semibold text-ok">Marcado.</p>
                          ) : t.estadoDaProposta === 'erro' ? (
                            <p role="alert" className="mt-2.5 text-secundario text-bad">
                              {t.erroDaProposta}
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => confirmarProposta(i)}
                              disabled={t.estadoDaProposta === 'executando'}
                              className="mt-2.5 grid h-12 w-full place-items-center rounded-[var(--radius-sm)] bg-acc font-semibold text-on-acc transition active:scale-[.98] disabled:opacity-60"
                            >
                              {t.estadoDaProposta === 'executando' ? 'Marcando…' : 'Confirmar'}
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={fimDaListaRef} />
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              perguntar(pergunta)
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={campoRef}
              value={pergunta}
              onChange={(e) => {
                setPergunta(e.target.value)
                ajustarAlturaDoCampo(e.target)
              }}
              onKeyDown={(e) => {
                // Enter envia, Shift+Enter quebra linha — mesmo padrão de qualquer chat grande.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  perguntar(pergunta)
                }
              }}
              placeholder="Pergunte alguma coisa…"
              maxLength={500}
              rows={1}
              className="max-h-32 min-h-12 flex-1 resize-none rounded-[var(--radius-sm)] border border-line bg-surface px-4 py-3 text-corpo text-txt outline-none focus:border-acc-2"
            />
            <button
              type="submit"
              className="grid h-12 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-acc px-4 font-semibold text-on-acc active:scale-[.97]"
            >
              Enviar
            </button>
          </form>

          <p className="text-label text-txt-3">
            O assistente lê os mesmos dados que você já vê. Ele não envia mensagem nem altera nada sozinho.
          </p>
        </>
      )}
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Abrir assistente"
        className={
          'fixed bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+16px)] right-[max(16px,calc((100vw-560px)/2+16px))] ' +
          'lg:bottom-6 lg:right-6 ' +
          'z-30 grid size-14 place-items-center rounded-[var(--radius-pill)] bg-acc text-on-acc shadow-flutuante ' +
          'transition active:scale-[.94]'
        }
      >
        <Sparkles aria-hidden className="size-6" />
      </button>

      {ehDesktop ? (
        aberto && posicao ? (
          <div
            ref={janelaRef}
            role="dialog"
            aria-label="Assistente"
            onPointerDown={iniciarArrasto}
            style={{ left: posicao.x, top: posicao.y, width: LARGURA_JANELA, maxHeight: ALTURA_MAX_JANELA }}
            className="fixed z-40 flex flex-col overflow-hidden rounded-[var(--radius-sheet)] border border-line-2 bg-surface shadow-flutuante"
          >
            {/* O cursor de "arrastar" só aparece aqui (dica visual mais forte), mas o
                `onPointerDown` está na janela inteira — arrastar funciona em qualquer parte que
                não seja botão/campo/link, não só nesta faixa. */}
            <div className="flex cursor-grab items-center justify-between gap-2 border-b border-line px-4 py-3 active:cursor-grabbing">
              <div className="flex items-center gap-2">
                <GripHorizontal aria-hidden className="size-4 text-txt-3" />
                <span className="text-secundario font-semibold text-txt">Assistente</span>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar assistente"
                className="grid size-8 place-items-center rounded-[var(--radius-sm)] text-txt-3 transition hover:bg-surface-2 hover:text-txt"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">{conteudo}</div>
          </div>
        ) : null
      ) : (
        <Sheet aberto={aberto} aoFechar={setAberto} titulo="Assistente" descricao="Pergunte sobre sua agenda, clientes e faturamento.">
          {conteudo}
        </Sheet>
      )}
    </>
  )
}
