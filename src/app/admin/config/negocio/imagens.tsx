'use client'

import { ImageUp, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

type Tipo = 'logo' | 'cover'

/**
 * Logo e capa da página pública.
 *
 * Componente separado do `formulario.tsx` porque o corpo aqui é `multipart/form-data` e vai para
 * outra rota (`/api/v1/tenant/vitrine`) — misturar com o PATCH de JSON obrigaria aquela rota a
 * carregar o caminho do `sharp`, que `sharp-so-onde-precisa.test.ts` existe para impedir.
 *
 * O envio é imediato ao escolher o arquivo, sem botão "salvar" próprio: imagem não é campo de
 * texto que a pessoa revisa antes de gravar — ela escolhe, e ou aparece na hora, ou o erro
 * explica. Ter um "salvar" separado do resto do formulário criaria dois botões com significados
 * diferentes na mesma tela.
 */
export default function ImagensDoSite({
  logoUrl,
  coverUrl,
}: {
  logoUrl: string | null
  coverUrl: string | null
}) {
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-titulo font-semibold text-txt">Imagens do seu site</h2>
        <p className="text-secundario text-txt-2">
          É o que faz sua página parecer sua, e não do sistema. Aparecem para quem abre o link que
          você manda.
        </p>
      </div>
      <CampoDeImagem
        tipo="logo"
        rotulo="Logo"
        ajuda="Aparece redonda, no topo da página. Uma imagem quadrada fica melhor."
        url={logoUrl}
        formato="size-20 rounded-full"
      />
      <CampoDeImagem
        tipo="cover"
        rotulo="Capa"
        ajuda="A faixa larga atrás do seu nome. Uma foto do espaço ou de um trabalho seu funciona bem."
        url={coverUrl}
        formato="h-24 w-full rounded-[var(--radius-sm)]"
      />
    </Card>
  )
}

function CampoDeImagem({
  tipo,
  rotulo,
  ajuda,
  url,
  formato,
}: {
  tipo: Tipo
  rotulo: string
  ajuda: string
  url: string | null
  formato: string
}) {
  const mostrarToast = useToast()
  const entrada = useRef<HTMLInputElement>(null)
  const [atual, setAtual] = useState(url)
  const [enviando, setEnviando] = useState(false)

  async function enviar(arquivo: File) {
    setEnviando(true)
    try {
      const form = new FormData()
      form.append('file', arquivo)
      form.append('tipo', tipo)

      const resposta = await fetch('/api/v1/tenant/vitrine', { method: 'POST', body: form })
      const json = (await resposta.json()) as { data?: { key: string }; error?: { message: string } }

      if (!resposta.ok) {
        mostrarToast({ tom: 'erro', titulo: `Não consegui subir a ${rotulo.toLowerCase()}`, descricao: json.error?.message ?? 'Tente outra imagem.' })
        return
      }
      /*
       * Recarrega do servidor em vez de montar a URL aqui: o endereço é montado num lugar só
       * (`core/text/vitrine.ts`), e duplicar essa regra no cliente é como ela passa a divergir.
       * O `router.refresh` do Next devolve a página com a chave nova já resolvida.
       */
      window.location.reload()
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira sua conexão e tente de novo.' })
    } finally {
      setEnviando(false)
    }
  }

  async function remover() {
    setEnviando(true)
    try {
      const resposta = await fetch(`/api/v1/tenant/vitrine?tipo=${tipo}`, { method: 'DELETE' })
      if (!resposta.ok) {
        mostrarToast({ tom: 'erro', titulo: `Não consegui remover a ${rotulo.toLowerCase()}`, descricao: 'Tente de novo.' })
        return
      }
      setAtual(null)
      mostrarToast({ tom: 'ok', titulo: `${rotulo} removida`, descricao: 'Sua página já está sem ela.' })
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira sua conexão e tente de novo.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label font-semibold text-txt-2">{rotulo}</span>

      <div className="flex items-center gap-3">
        {atual ? (
          /* Já é WebP dimensionado no upload — ver o comentário em `(public)/[slug]/secoes.tsx`. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={atual} alt={`${rotulo} atual`} className={`${formato} border border-line-2 bg-surface-2 object-cover`} />
        ) : (
          <div className={`${formato} grid place-items-center border border-dashed border-line-2 bg-surface-2 text-txt-3`}>
            <ImageUp aria-hidden className="size-5" />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={enviando}
            className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 text-secundario font-semibold text-txt transition hover:bg-surface-3 disabled:opacity-60"
          >
            <ImageUp aria-hidden className="size-4" />
            {enviando ? 'Enviando…' : atual ? 'Trocar' : 'Escolher imagem'}
          </button>

          {atual ? (
            <button
              type="button"
              onClick={remover}
              disabled={enviando}
              className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-secundario text-txt-3 transition hover:text-bad disabled:opacity-60"
            >
              <Trash2 aria-hidden className="size-4" />
              Remover
            </button>
          ) : null}
        </div>
      </div>

      <p className="text-label text-txt-3">{ajuda} Até 2MB.</p>

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
