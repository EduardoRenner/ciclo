'use client'

import { GripHorizontal, Sparkles, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import Card from '@/components/ui/card'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'

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

type RespostaOk = { resposta: string; ferramentasUsadas: string[] }
type Turno = { pergunta: string; resposta: string; carregando?: boolean }

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
 * Escopo conhecido desta fase: o "cartão estruturado" do §5 (número grande + lista + botões) fica
 * para quando as ferramentas devolverem forma própria de UI; por ora a resposta do modelo já vem
 * em texto redigido, mostrada dentro de um Card — cartão de verdade, nunca parágrafo solto na
 * tela, mas sem o detalhamento visual da versão final.
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

  if (!disponivel) return null

  function abrir() {
    if (ehDesktop && !posicao) setPosicao(posicaoPadrao())
    setAberto(true)
  }

  function iniciarArrasto(e: React.PointerEvent) {
    const janela = janelaRef.current
    if (!janela) return
    arrastandoRef.current = { offsetX: e.clientX - janela.getBoundingClientRect().left, offsetY: e.clientY - janela.getBoundingClientRect().top }
  }

  async function perguntar(texto: string, idRapido?: string) {
    const limpo = texto.trim()
    if (!limpo || turnos.some((t) => t.carregando)) return

    setPergunta('')
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
      setTurnos((atual) => atual.map((t, i) => (i === atual.length - 1 ? { ...t, resposta: corpo.data.resposta, carregando: false } : t)))
    } catch {
      setTurnos((atual) => atual.map((t, i) => (i === atual.length - 1 ? { ...t, resposta: 'Não consegui responder agora.', carregando: false } : t)))
      mostrarToast({ tom: 'erro', titulo: 'Sem conexão com o assistente' })
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
            <div className="flex flex-col gap-3">
              {turnos.map((t, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <p className="text-secundario font-semibold text-txt-3">{t.pergunta}</p>
                  <Card flutuante>
                    {t.carregando ? (
                      <span className="text-corpo text-txt-3">Consultando…</span>
                    ) : (
                      <span className="text-corpo text-txt">{t.resposta}</span>
                    )}
                  </Card>
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              perguntar(pergunta)
            }}
            className="flex gap-2"
          >
            <input
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Pergunte alguma coisa…"
              maxLength={500}
              className="h-12 flex-1 rounded-[var(--radius-sm)] border border-line bg-surface px-4 text-corpo text-txt outline-none focus:border-acc-2"
            />
            <button
              type="submit"
              className="grid h-12 place-items-center rounded-[var(--radius-sm)] bg-acc px-4 font-semibold text-on-acc active:scale-[.97]"
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
            style={{ left: posicao.x, top: posicao.y, width: LARGURA_JANELA, maxHeight: ALTURA_MAX_JANELA }}
            className="fixed z-40 flex flex-col overflow-hidden rounded-[var(--radius-sheet)] border border-line-2 bg-surface shadow-flutuante"
          >
            <div
              onPointerDown={iniciarArrasto}
              className="flex cursor-grab items-center justify-between gap-2 border-b border-line px-4 py-3 active:cursor-grabbing"
            >
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
