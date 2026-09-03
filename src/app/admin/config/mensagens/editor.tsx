'use client'

import { Eye, MessageSquare, MessageSquarePlus, Trash2 } from 'lucide-react'
import { useRef, useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { aplicarVariaveis, VARIAVEIS_DISPONIVEIS } from '@/lib/mensagens'

type Modelo = { id: string; slug: string; title: string; body: string; active: boolean; position: number }

/** Exemplo fixo só para a prévia — a pessoa precisa VER como o texto chega, não imaginar. */
const EXEMPLO = {
  nome: 'Bruno Almeida',
  servico: 'Corte + barba',
  data: '12/09',
  hora: '15:30',
  valor: 'R$ 70,00',
}

export default function EditorModelos({ iniciais, nomeDoNegocio }: { iniciais: Modelo[]; nomeDoNegocio: string }) {
  const mostrarToast = useToast()
  const [modelos, setModelos] = useState(iniciais)
  const [editando, setEditando] = useState<Modelo | 'novo' | null>(null)
  const [salvando, iniciarSalvamento] = useTransition()

  const [titulo, setTitulo] = useState('')
  const [corpo, setCorpo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const areaTexto = useRef<HTMLTextAreaElement>(null)

  function abrir(alvo: Modelo | 'novo') {
    setErro(null)
    setEditando(alvo)
    setTitulo(alvo === 'novo' ? '' : alvo.title)
    setCorpo(alvo === 'novo' ? '' : alvo.body)
  }

  /** Insere `{{chave}}` onde o cursor está — digitar chave na mão é onde o erro de digitação nasce. */
  function inserirVariavel(chave: string) {
    const el = areaTexto.current
    const marca = `{{${chave}}}`
    if (!el) {
      setCorpo((c) => c + marca)
      return
    }
    const inicio = el.selectionStart ?? corpo.length
    const fim = el.selectionEnd ?? corpo.length
    const novo = corpo.slice(0, inicio) + marca + corpo.slice(fim)
    setCorpo(novo)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(inicio + marca.length, inicio + marca.length)
    })
  }

  function salvar() {
    setErro(null)
    const novo = editando === 'novo'
    iniciarSalvamento(async () => {
      try {
        const r = await fetch(novo ? '/api/v1/message-templates' : `/api/v1/message-templates/${(editando as Modelo).id}`, {
          method: novo ? 'POST' : 'PATCH',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ title: titulo, body: corpo }),
        })
        const json = (await r.json()) as { data?: Modelo; error?: { message: string; details?: { fields?: Record<string, string> } } }
        if (!r.ok || !json.data) {
          const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
          setErro(campo ?? json.error?.message ?? 'Não consegui salvar.')
          return
        }
        const salvo = json.data
        setModelos((atual) => (novo ? [...atual, salvo] : atual.map((m) => (m.id === salvo.id ? salvo : m))))
        mostrarToast({ tom: 'ok', titulo: novo ? 'Modelo criado' : 'Modelo atualizado' })
        setEditando(null)
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  function apagar(id: string) {
    iniciarSalvamento(async () => {
      try {
        const r = await fetch(`/api/v1/message-templates/${id}`, {
          method: 'DELETE',
          headers: { 'idempotency-key': crypto.randomUUID() },
        })
        if (!r.ok) {
          mostrarToast({ tom: 'erro', titulo: 'Não consegui apagar' })
          return
        }
        setModelos((atual) => atual.filter((m) => m.id !== id))
        mostrarToast({ tom: 'ok', titulo: 'Modelo apagado' })
        setEditando(null)
      } catch {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira a conexão e tente de novo.' })
      }
    })
  }

  return (
    <div className="pb-8">
      {modelos.length > 0 ? (
        <Button variante="secondary" largura="cheia" onClick={() => abrir('novo')} className="mb-4">
          <MessageSquarePlus aria-hidden className="size-4" />
          Criar modelo
        </Button>
      ) : null}

      {modelos.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icone={<MessageSquare aria-hidden className="size-6" />}
            titulo="Nenhum modelo salvo"
            descricao="Modelos são mensagens prontas com o nome e a data já no lugar. Você só revisa e envia."
            acao={<Button onClick={() => abrir('novo')}>Criar modelo</Button>}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {modelos.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => abrir(m)} className="w-full text-left">
                <Card className="transition-colors hover:border-acc/40 hover:bg-surface-2">
                  <p className="text-corpo font-semibold">{m.title}</p>
                  <p className="mt-1 line-clamp-2 text-secundario text-txt-2">
                    {aplicarVariaveis(m.body, { ...EXEMPLO, negocio: nomeDoNegocio })}
                  </p>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        aberto={editando !== null}
        aoFechar={(a) => !a && setEditando(null)}
        titulo={editando === 'novo' ? 'Novo modelo' : 'Editar modelo'}
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Nome do modelo</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Lembrete de amanhã"
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Mensagem</span>
            <textarea
              ref={areaTexto}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={5}
              placeholder="Oi {{nome}}, tudo bem?"
              className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 py-2 text-corpo text-txt"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {VARIAVEIS_DISPONIVEIS.map((v) => (
              <button
                key={v.chave}
                type="button"
                onClick={() => inserirVariavel(v.chave)}
                className="rounded-[var(--radius-pill)] border border-line-2 bg-surface-2 px-3 py-1.5 text-label font-semibold text-txt-2 transition-colors hover:border-acc/40 hover:text-txt"
              >
                + {v.rotulo}
              </button>
            ))}
          </div>

          {corpo.trim() ? (
            <div className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
                <Eye className="size-3.5" />
                Como a cliente vê
              </p>
              <p className="mt-2 whitespace-pre-wrap text-corpo text-txt">
                {aplicarVariaveis(corpo, { ...EXEMPLO, negocio: nomeDoNegocio })}
              </p>
            </div>
          ) : null}

          {erro ? (
            <p role="alert" className="text-secundario text-bad">
              {erro}
            </p>
          ) : null}

          <Button largura="cheia" carregando={salvando} onClick={salvar}>
            Salvar modelo
          </Button>

          {editando !== 'novo' && editando !== null ? (
            <button
              type="button"
              onClick={() => apagar(editando.id)}
              className="flex items-center justify-center gap-1.5 py-2 text-secundario text-txt-3 transition-colors hover:text-bad"
            >
              <Trash2 aria-hidden className="size-4" />
              Apagar modelo
            </button>
          ) : null}
        </div>
      </Sheet>
    </div>
  )
}
