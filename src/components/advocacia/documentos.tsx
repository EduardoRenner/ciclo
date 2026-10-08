'use client'

import { FileText, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import Badge from '@/components/ui/badge'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import Select from '@/components/ui/select'
import Textarea from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { CATEGORIAS, ROTULO_DO_STATUS_DO_DOCUMENTO, type CategoriaDoDocumento, type DocumentoNaLista } from '@/core/advocacia/documentos'

type Props = {
  documentos: DocumentoNaLista[]
  clienteId: string
  casoId?: string
  /** O plano libera documentos? Decidido no servidor ANTES do formulário (guarda `toda-rota-travada`). */
  podeEnviar: boolean
}

async function erroDa(r: Response, padrao: string): Promise<string> {
  const json = (await r.json().catch(() => ({}))) as { error?: { message?: string; details?: { fields?: Record<string, string> } } }
  const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
  return campo ?? json.error?.message ?? padrao
}

/**
 * docs/101 T2.3: os documentos de um caso ou de um cliente. Abrir pede a URL ao servidor (que grava a
 * trilha antes) e abre numa aba nova; a URL vale 60 s e não fica na tela. Documento recebido do cliente
 * aparece "a conferir" até alguém aceitar ou recusar com motivo.
 */
export default function DocumentosDoCaso({ documentos, clienteId, casoId, podeEnviar }: Props) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [pendente, iniciar] = useTransition()
  const [enviando, setEnviando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState<CategoriaDoDocumento>('outro')
  const [origem, setOrigem] = useState<'equipe' | 'cliente'>('cliente')
  const [erro, setErro] = useState<{ onde: string; texto: string } | null>(null)
  const [recusando, setRecusando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const arquivo = useRef<HTMLInputElement>(null)

  function enviar() {
    const f = arquivo.current?.files?.[0]
    if (!f) return setErro({ onde: 'envio', texto: 'Escolha o arquivo.' })
    setErro(null)
    iniciar(async () => {
      try {
        const corpo = new FormData()
        corpo.set('file', f)
        corpo.set('clientId', clienteId)
        if (casoId) corpo.set('caseId', casoId)
        corpo.set('title', titulo || f.name.replace(/\.[^.]+$/, '').slice(0, 200))
        corpo.set('category', categoria)
        corpo.set('origin', origem)
        const r = await fetch('/api/v1/legal/documents', { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() }, body: corpo })
        if (!r.ok) return setErro({ onde: 'envio', texto: await erroDa(r, 'Não consegui enviar. Tente de novo.') })
        mostrarToast({ tom: 'ok', titulo: origem === 'cliente' ? 'Documento recebido. Aguardando conferência.' : 'Documento salvo' })
        setEnviando(false)
        setTitulo('')
        router.refresh()
      } catch {
        setErro({ onde: 'envio', texto: 'Não consegui falar com o servidor. Confira a conexão e tente de novo.' })
      }
    })
  }

  function abrir(id: string) {
    setErro(null)
    // A aba nasce no toque (senão o navegador a bloqueia como pop-up) e recebe a URL quando ela chegar.
    // Sem `noopener` no `open` (com ele o retorno é `null`); o vínculo com esta página é cortado logo em seguida.
    const aba = window.open('', '_blank')
    if (aba) aba.opener = null
    iniciar(async () => {
      try {
        const r = await fetch(`/api/v1/legal/documents/${id}/open`, { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() } })
        if (!r.ok) {
          aba?.close()
          return setErro({ onde: id, texto: await erroDa(r, 'Não consegui abrir o documento.') })
        }
        const { data } = (await r.json()) as { data: { url: string } }
        if (aba) aba.location.href = data.url
        else window.location.href = data.url
      } catch {
        aba?.close()
        setErro({ onde: id, texto: 'Não consegui falar com o servidor. Confira a conexão e tente de novo.' })
      }
    })
  }

  function conferir(d: DocumentoNaLista, acao: 'aceitar' | 'recusar') {
    setErro(null)
    iniciar(async () => {
      try {
        const r = await fetch(`/api/v1/legal/documents/${d.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ acao, rowVersion: d.rowVersion, ...(acao === 'recusar' ? { motivo } : {}) }),
        })
        if (!r.ok) {
          setErro({ onde: d.id, texto: await erroDa(r, 'Não consegui salvar a conferência.') })
          if (r.status === 409) router.refresh()
          return
        }
        mostrarToast({ tom: 'ok', titulo: acao === 'aceitar' ? 'Documento aceito' : 'Documento recusado' })
        setRecusando(null)
        setMotivo('')
        router.refresh()
      } catch {
        setErro({ onde: d.id, texto: 'Não consegui falar com o servidor. Confira a conexão e tente de novo.' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={pendente}>
      {documentos.length === 0 ? (
        <p className="text-secundario text-txt-2">Nenhum documento ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documentos.map((d) => {
            const aConferir = d.status === 'recebido' || d.status === 'em_conferencia'
            return (
              <li key={d.id}>
                <Card className="flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-txt-2" />
                      <div className="min-w-0">
                        <p className="truncate text-corpo">{d.titulo}</p>
                        <p className="text-label text-txt-3">
                          {CATEGORIAS[d.categoria as CategoriaDoDocumento] ?? 'Outro'}
                          {d.versao > 1 ? ` · versão ${d.versao}` : ''}
                          {d.validade ? ` · vale até ${d.validade.slice(8, 10)}/${d.validade.slice(5, 7)}` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge estado={d.status === 'aceito' ? 'ok' : d.status === 'recusado' ? 'bad' : 'warn'} className="shrink-0 whitespace-nowrap">
                      {ROTULO_DO_STATUS_DO_DOCUMENTO[d.status as keyof typeof ROTULO_DO_STATUS_DO_DOCUMENTO] ?? d.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button tamanho="sm" variante="secondary" onClick={() => abrir(d.id)} disabled={pendente} motivoDesabilitado="Aguarde a ação anterior.">
                      Abrir
                    </Button>
                    {aConferir && recusando !== d.id ? (
                      <>
                        <Button tamanho="sm" variante="secondary" onClick={() => conferir(d, 'aceitar')} disabled={pendente} motivoDesabilitado="Aguarde a ação anterior.">
                          Aceitar
                        </Button>
                        <Button tamanho="sm" variante="ghost" onClick={() => (setRecusando(d.id), setMotivo(''))}>
                          Recusar
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {recusando === d.id ? (
                    <div className="flex flex-col gap-2">
                      <Textarea rotulo="Por que recusar" ajuda="O cliente vai precisar mandar de novo." rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
                      <div className="flex gap-2">
                        <Button
                          tamanho="sm"
                          variante="danger"
                          disabled={motivo.trim().length < 5}
                          motivoDesabilitado="Escreva o motivo com pelo menos 5 letras."
                          carregando={pendente}
                          onClick={() => conferir(d, 'recusar')}
                        >
                          Recusar documento
                        </Button>
                        <Button tamanho="sm" variante="ghost" onClick={() => setRecusando(null)}>
                          Voltar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {erro?.onde === d.id ? (
                    <p role="alert" className="text-secundario text-bad">
                      {erro.texto}
                    </p>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {!podeEnviar ? (
        <p className="text-secundario text-txt-2">Guardar documentos faz parte de um plano acima do atual. Veja em Configurações, Meu plano.</p>
      ) : enviando ? (
        <Card className="flex flex-col gap-3 p-3">
          <label className="flex flex-col gap-1.5 text-label font-semibold text-txt-2">
            Arquivo
            <input
              ref={arquivo}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.docx,.xlsx,.odt,.txt"
              className="min-h-12 text-corpo font-normal text-txt file:mr-3 file:h-10 file:rounded-[var(--radius-sm)] file:border file:border-line-2 file:bg-surface-2 file:px-3"
            />
          </label>
          <Input rotulo="Nome do documento" ajuda="Sem nome? Usamos o do arquivo." value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} />
          <Select rotulo="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDoDocumento)}>
            {Object.entries(CATEGORIAS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select rotulo="De onde veio" value={origem} onChange={(e) => setOrigem(e.target.value as 'equipe' | 'cliente')}>
            <option value="cliente">O cliente mandou (fica a conferir)</option>
            <option value="equipe">Feito pela equipe</option>
          </Select>
          {erro?.onde === 'envio' ? (
            <p role="alert" className="text-secundario text-bad">
              {erro.texto}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button tamanho="sm" carregando={pendente} onClick={enviar}>
              Enviar
            </Button>
            <Button tamanho="sm" variante="ghost" onClick={() => setEnviando(false)}>
              Voltar
            </Button>
          </div>
        </Card>
      ) : (
        <Button tamanho="sm" variante="secondary" className="self-start" onClick={() => setEnviando(true)}>
          <Upload aria-hidden className="size-4" />
          Adicionar documento
        </Button>
      )}
    </div>
  )
}
