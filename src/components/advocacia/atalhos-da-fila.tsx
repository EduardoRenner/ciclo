'use client'

import { useEffect, useRef } from 'react'

import { comandoDaTecla, ehCampo, indiceDepois } from '@/core/advocacia/atalhos'

/**
 * docs/101 T5.4: j/k/c nas filas. Os itens marcam `data-atalho-item` (o elemento que recebe o foco: o link no
 * Hoje, o `li` na Pendências) e a primeira ação marca `data-atalho-acao`. Item escondido (grupo fechado em
 * `details`) não conta: o foco nunca vai para onde a pessoa não vê.
 */
export default function AtalhosDaFila({ children, modo }: { children: React.ReactNode; modo: 'abrir' | 'agir' }) {
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const comando = comandoDaTecla({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, emCampo: ehCampo(e.target as HTMLElement | null) })
      if (!comando || !raiz.current) return
      const itens = [...raiz.current.querySelectorAll<HTMLElement>('[data-atalho-item]')].filter((el) => el.getClientRects().length > 0)
      const atual = itens.findIndex((el) => el.contains(document.activeElement))
      if (comando === 'primeira_acao') {
        const botao = atual >= 0 ? itens[atual]!.querySelector<HTMLButtonElement>('[data-atalho-acao]') : null
        if (!botao || botao.disabled) return
        e.preventDefault()
        botao.click()
        return
      }
      const destino = indiceDepois(atual, itens.length, comando)
      if (destino === null) return
      e.preventDefault()
      const alvo = itens[destino]!
      alvo.setAttribute('data-foco-atalho', '')
      alvo.addEventListener('blur', () => alvo.removeAttribute('data-foco-atalho'), { once: true })
      alvo.focus()
      alvo.scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  return (
    <div ref={raiz}>
      <p className="mb-3 hidden text-label text-txt-3 lg:block">
        Atalhos: <kbd className="font-semibold">j</kbd> e <kbd className="font-semibold">k</kbd> andam pela fila,{' '}
        {modo === 'abrir' ? (
          <>
            <kbd className="font-semibold">Enter</kbd> abre o item.
          </>
        ) : (
          <>
            <kbd className="font-semibold">c</kbd> faz a primeira ação do item.
          </>
        )}
      </p>
      {children}
    </div>
  )
}
