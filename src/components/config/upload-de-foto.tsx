'use client'

import { ImageUp, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { useToast } from '@/components/ui/toast'

/**
 * Escolher e trocar a foto de um serviço ou de um profissional.
 *
 * Componente próprio, e não mais um campo dentro de cada formulário, porque o envio é
 * `multipart/form-data` para uma rota separada (`/api/v1/tenant/vitrine/entidade`) enquanto os
 * formulários mandam JSON para as rotas de sempre. Misturar obrigaria aquelas rotas a carregar o
 * caminho do `sharp` — 19,2 MB de libvips que `sharp-so-onde-precisa.test.ts` existe para manter
 * longe de quem não processa imagem.
 *
 * Envia na hora, sem depender do "salvar" do formulário ao redor: imagem não é campo de texto que
 * a pessoa revisa antes de gravar, e dois botões de salvar com significados diferentes na mesma
 * tela é o tipo de ambiguidade que faz alguém sair achando que perdeu o trabalho.
 */
export default function UploadDeFoto({
  tipo,
  id,
  urlAtual,
  formato = 'quadrada',
  aoTrocar,
}: {
  tipo: 'service' | 'professional'
  /** `null` enquanto a linha não existe (formulário de criação) — aí o campo aparece desabilitado. */
  id: string | null
  urlAtual: string | null
  formato?: 'quadrada' | 'redonda'
  aoTrocar?: (url: string | null) => void
}) {
  const mostrarToast = useToast()
  const entrada = useRef<HTMLInputElement>(null)
  const [atual, setAtual] = useState(urlAtual)
  const [enviando, setEnviando] = useState(false)

  const molde = formato === 'redonda' ? 'size-16 rounded-full' : 'size-16 rounded-[var(--radius-sm)]'
  const rotulo = tipo === 'service' ? 'foto do serviço' : 'foto'

  async function enviar(arquivo: File) {
    if (!id) return
    setEnviando(true)
    try {
      const form = new FormData()
      form.append('file', arquivo)
      form.append('tipo', tipo)
      form.append('id', id)

      const resposta = await fetch('/api/v1/tenant/vitrine/entidade', { method: 'POST', body: form })
      const json = (await resposta.json()) as { data?: { key: string }; error?: { message: string } }

      if (!resposta.ok) {
        mostrarToast({ tom: 'erro', titulo: `Não consegui subir a ${rotulo}`, descricao: json.error?.message ?? 'Tente outra imagem.' })
        return
      }

      /*
       * Prévia local via `URL.createObjectURL`, e não a URL do bucket: o endereço público é
       * montado num lugar só (`core/text/vitrine.ts`) e remontá-lo aqui duplicaria a regra. O
       * arquivo local mostra exatamente o que acabou de subir, e o endereço de verdade chega na
       * próxima leitura da página.
       */
      const previa = URL.createObjectURL(arquivo)
      setAtual(previa)
      aoTrocar?.(previa)
      mostrarToast({ tom: 'ok', titulo: 'Foto atualizada', descricao: 'Ela já aparece na sua página.' })
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira sua conexão e tente de novo.' })
    } finally {
      setEnviando(false)
    }
  }

  async function remover() {
    if (!id) return
    setEnviando(true)
    try {
      const resposta = await fetch(`/api/v1/tenant/vitrine/entidade?tipo=${tipo}&id=${id}`, { method: 'DELETE' })
      if (!resposta.ok) {
        mostrarToast({ tom: 'erro', titulo: `Não consegui remover a ${rotulo}`, descricao: 'Tente de novo.' })
        return
      }
      setAtual(null)
      aoTrocar?.(null)
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira sua conexão e tente de novo.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {atual ? (
        /* Já é WebP dimensionado no upload — ver o comentário em `(public)/[slug]/secoes.tsx`. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={atual} alt="" className={`${molde} shrink-0 border border-line-2 bg-surface-2 object-cover`} />
      ) : (
        <div className={`${molde} grid shrink-0 place-items-center border border-dashed border-line-2 bg-surface-2 text-txt-3`}>
          <ImageUp aria-hidden className="size-5" />
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={enviando || !id}
            className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-secundario font-semibold text-txt transition hover:bg-surface-3 disabled:opacity-50"
          >
            <ImageUp aria-hidden className="size-4" />
            {enviando ? 'Enviando…' : atual ? 'Trocar foto' : 'Adicionar foto'}
          </button>
          {atual ? (
            <button
              type="button"
              onClick={remover}
              disabled={enviando}
              className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-secundario text-txt-3 transition hover:text-bad disabled:opacity-50"
            >
              <Trash2 aria-hidden className="size-4" />
              Remover
            </button>
          ) : null}
        </div>
        <p className="text-label text-txt-3">
          {id ? 'Aparece na sua página pública. Até 2MB.' : 'Salve primeiro para poder adicionar uma foto.'}
        </p>
      </div>

      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          // Limpa o valor para que escolher o MESMO arquivo de novo (depois de um erro) dispare
          // o `change` outra vez — sem isso, a segunda tentativa não faz nada.
          e.target.value = ''
          if (arquivo) void enviar(arquivo)
        }}
      />
    </div>
  )
}
