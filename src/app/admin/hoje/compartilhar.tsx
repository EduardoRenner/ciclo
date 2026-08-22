'use client'

import { Share2 } from 'lucide-react'

import { useToast } from '@/components/ui/toast'

/**
 * A ação que mais vale para uma conta nova é mandar o link de agendamento para
 * as clientes — e ela não existia em lugar nenhum: dava para *ver* o próprio
 * site, nunca para compartilhá-lo. Copiar da barra do navegador não é opção num
 * PWA instalado, que não tem barra.
 *
 * `navigator.share` abre a folha nativa do celular (WhatsApp, Instagram, colar
 * na bio); onde ela não existe — desktop, navegador antigo — cai para a área de
 * transferência, que resolve o mesmo problema sem tela extra.
 */
export default function CompartilharSite({ slug, nome }: { slug: string; nome: string }) {
  const mostrarToast = useToast()

  async function compartilhar() {
    const url = `${window.location.origin}/${slug}`
    const texto = `Agende seu horário na ${nome}: ${url}`

    if (navigator.share) {
      try {
        await navigator.share({ title: nome, text: texto, url })
        return
      } catch {
        // Cancelar a folha nativa chega aqui como erro; não é falha para avisar.
        return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      mostrarToast({ tom: 'ok', titulo: 'Link copiado', descricao: 'Cole na bio do Instagram ou mande no WhatsApp.' })
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui copiar', descricao: `Seu link é ${url}` })
    }
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      aria-label="Compartilhar meu link de agendamento"
      className="grid size-12 place-items-center rounded-[var(--radius-pill)] text-acc-2 transition hover:bg-surface-2 active:scale-[.94]"
    >
      <Share2 aria-hidden className="size-5" />
    </button>
  )
}
