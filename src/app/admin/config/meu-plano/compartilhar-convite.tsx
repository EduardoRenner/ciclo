'use client'

import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Share2 } from 'lucide-react'
import { useState } from 'react'

/**
 * T4 (docs/64 §0.4/§0.9): capacidade nativa genuína, não decorativa — dentro do app o sistema
 * abre o seletor de compartilhamento de verdade (WhatsApp, SMS, o que a pessoa tiver), em vez de
 * um link fixo pro WhatsApp que ignora qualquer outro app instalado. Fora do app (navegador comum),
 * cai pro link de sempre — `Capacitor.isNativePlatform()` decide, e só decide no CLIENTE porque é
 * exatamente o que essa API descreve: onde o JavaScript está rodando agora, não de onde veio a
 * requisição (esse é o trabalho de `ehRequisicaoDoAppNativo`, usado no servidor).
 */
export default function CompartilharConvite({ texto, hrefWhatsApp }: { texto: string; hrefWhatsApp: string }) {
  // Lido uma vez, no primeiro render — a plataforma não muda no meio da vida do componente.
  const [nativo] = useState(() => Capacitor.isNativePlatform())

  if (nativo) {
    return (
      <button
        type="button"
        onClick={async () => {
          try {
            await Share.share({ text: texto })
          } catch {
            // Pessoa cancelou o seletor, ou o SO recusou — nunca trava a tela; só não faz nada.
          }
        }}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.97]"
      >
        <Share2 aria-hidden className="size-4" />
        Mandar para um colega
      </button>
    )
  }

  return (
    <a
      href={hrefWhatsApp}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.97]"
    >
      <Share2 aria-hidden className="size-4" />
      Mandar para um colega
    </a>
  )
}
