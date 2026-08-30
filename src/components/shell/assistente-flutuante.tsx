'use client'

import { Sparkles } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

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

/**
 * docs/26-AGENTE-IA-PLANO.md §5/§6 (A7) — painel lateral do assistente, presente em toda tela do
 * `/admin`. `disponivel` vem do layout (server component, `Boolean(process.env.GEMINI_API_KEY)`,
 * sem I/O) — sem credencial, este componente nem monta o botão (§4.4: nunca degradar em
 * silêncio, nunca aparecer para depois falhar).
 *
 * Escopo conhecido desta fase: o "cartão estruturado" do §5 (número grande + lista + botões) fica
 * para quando as ferramentas devolverem forma própria de UI; por ora a resposta do modelo já vem
 * em texto redigido, mostrada dentro de um Card — cartão de verdade, nunca parágrafo solto na
 * tela, mas sem o detalhamento visual da versão final.
 */
export default function AssistenteFlutuante({ disponivel }: { disponivel: boolean }) {
  const pathname = usePathname()
  const mostrarToast = useToast()
  const [aberto, setAberto] = useState(false)
  const [pergunta, setPergunta] = useState('')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [indisponivel, setIndisponivel] = useState(false)

  if (!disponivel) return null

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

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir assistente"
        className={
          'fixed bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+16px)] right-[max(16px,calc((100vw-560px)/2+16px))] ' +
          'z-30 grid size-14 place-items-center rounded-[var(--radius-pill)] bg-acc text-on-acc shadow-flutuante ' +
          'transition active:scale-[.94]'
        }
      >
        <Sparkles aria-hidden className="size-6" />
      </button>

      <Sheet aberto={aberto} aoFechar={setAberto} titulo="Assistente" descricao="Pergunte sobre sua agenda, clientes e faturamento.">
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
      </Sheet>
    </>
  )
}
