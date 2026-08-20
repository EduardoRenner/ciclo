'use client'

import { Upload } from 'lucide-react'
import { useRef, useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

type Preview = { colunas: string[]; sample: Record<string, string>[] }
type Resultado = { imported: number; skipped: { linha: number; motivo: string }[]; errors: { linha: number; motivo: string }[] }
type Mapeamento = { name: string; phone: string; email: string; tags: string }

const CAMPO_VAZIO = '__nenhum__'

async function enviarMultipart<T>(url: string, form: FormData): Promise<T> {
  const r = await fetch(url, { method: 'POST', body: form })
  const json = (await r.json()) as { data?: T; error?: { message: string } }
  if (!r.ok) throw new Error(json.error?.message ?? 'Não consegui processar o arquivo.')
  return json.data as T
}

export default function Importador() {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [mapa, setMapa] = useState<Mapeamento>({ name: '', phone: '', email: '', tags: '' })
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [pendente, iniciarTransicao] = useTransition()
  const mostrarToast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  function escolherArquivo(f: File) {
    setArquivo(f)
    setPreview(null)
    setResultado(null)

    iniciarTransicao(async () => {
      try {
        const form = new FormData()
        form.set('file', f)
        const p = await enviarMultipart<Preview>('/api/v1/clients/import/preview', form)
        setPreview(p)
        // Chute inicial: coluna cujo nome já bate com o campo.
        const achar = (alvo: string) => p.colunas.find((c) => c.toLowerCase().includes(alvo)) ?? ''
        setMapa({ name: achar('nome'), phone: achar('telefone'), email: achar('mail'), tags: achar('etiqueta') })
      } catch (erro) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui ler o arquivo', descricao: (erro as Error).message })
      }
    })
  }

  function confirmarImportacao() {
    if (!arquivo || !mapa.name) return

    iniciarTransicao(async () => {
      try {
        const form = new FormData()
        form.set('file', arquivo)
        form.set(
          'mapping',
          JSON.stringify({
            name: mapa.name,
            phone: mapa.phone || undefined,
            email: mapa.email || undefined,
            tags: mapa.tags || undefined,
          }),
        )
        const r = await enviarMultipart<Resultado>('/api/v1/clients/import', form)
        setResultado(r)
        mostrarToast({ tom: 'ok', titulo: 'Importação concluída', descricao: `${r.imported} clientes importados.` })
      } catch (erro) {
        mostrarToast({ tom: 'erro', titulo: 'A importação falhou', descricao: (erro as Error).message })
      }
    })
  }

  return (
    <div aria-busy={pendente} className="flex flex-col gap-6">
      {!preview ? (
        <Card
          className="flex flex-col items-center gap-3 border-dashed py-10 text-center"
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <Upload aria-hidden className="size-8 text-txt-3" />
          <p className="text-corpo font-semibold">Toque para escolher o arquivo CSV</p>
          <p className="text-secundario text-txt-2">Até 5 MB, 5.000 linhas.</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) escolherArquivo(f)
            }}
          />
        </Card>
      ) : null}

      {preview ? (
        <>
          <section>
            <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
              Qual coluna é qual
            </h2>
            <div className="flex flex-col gap-3">
              {(
                [
                  ['name', 'Nome (obrigatório)'],
                  ['phone', 'Telefone'],
                  ['email', 'E-mail'],
                  ['tags', 'Etiquetas'],
                ] as const
              ).map(([campo, rotulo]) => (
                <label key={campo} className="flex flex-col gap-1">
                  <span className="text-label font-semibold text-txt-2">{rotulo}</span>
                  <select
                    value={mapa[campo] || CAMPO_VAZIO}
                    onChange={(e) =>
                      setMapa((atual) => ({ ...atual, [campo]: e.target.value === CAMPO_VAZIO ? '' : e.target.value }))
                    }
                    className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
                  >
                    <option value={CAMPO_VAZIO}>Nenhuma</option>
                    {preview.colunas.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
              Prévia (primeiras linhas)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-secundario">
                <thead>
                  <tr>
                    {preview.colunas.map((c) => (
                      <th key={c} className="whitespace-nowrap px-2 py-1 text-left text-txt-2">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((linha, i) => (
                    <tr key={i} className="border-t border-line">
                      {preview.colunas.map((c) => (
                        <td key={c} className="whitespace-nowrap px-2 py-1 text-txt">
                          {linha[c]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {resultado ? (
            <Card>
              <p className="text-corpo font-semibold">{resultado.imported} clientes importados</p>
              {resultado.skipped.length > 0 ? (
                <p className="mt-1 text-secundario text-warn">{resultado.skipped.length} não importadas (duplicata)</p>
              ) : null}
              {resultado.errors.length > 0 ? (
                <div className="mt-2">
                  <p className="text-secundario text-bad">{resultado.errors.length} linha(s) com erro:</p>
                  <ul className="mt-1 list-inside list-disc text-secundario text-txt-2">
                    {resultado.errors.slice(0, 10).map((e) => (
                      <li key={e.linha}>
                        Linha {e.linha}: {e.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          ) : (
            <Button largura="cheia" carregando={pendente} disabled={!mapa.name} onClick={confirmarImportacao}>
              Importar
            </Button>
          )}
        </>
      ) : null}
    </div>
  )
}
