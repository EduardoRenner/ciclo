'use client'

import { useEffect, useState } from 'react'

import Segmented from '@/components/ui/segmented'

/**
 * Claro, escuro ou o que o sistema pedir. Pedido do dono em 2026-09-10.
 *
 * O padrão é **sistema**: nesse modo não há `data-theme` no `<html>`, e o `@media
 * (prefers-color-scheme)` do `globals.css` decide. Escolher claro ou escuro crava um
 * `data-theme` que ganha do sistema — e o `<script>` do `layout.tsx` relê isso antes da primeira
 * pintura, então a escolha não pisca na navegação de página inteira.
 *
 * `ciclo-tema` no `localStorage`: `'claro'` | `'escuro'` | ausente (= sistema). Ausente e não
 * `'sistema'` de propósito — é o estado que não precisa ser gravado.
 */

type Escolha = 'sistema' | 'claro' | 'escuro'

const SEGMENTOS = [
  { valor: 'sistema', rotulo: 'Automático' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
]

/** `light`/`dark` são os valores que o CSS e o script anti-flash entendem; `null` = tira o atributo. */
const DATA_THEME: Record<Escolha, 'light' | 'dark' | null> = {
  sistema: null,
  claro: 'light',
  escuro: 'dark',
}

/** A cor da barra do navegador em cada tema — o mesmo `--bg` de `globals.css`. */
const COR_DA_BARRA = { light: '#faf8f5', dark: '#0d0c0c' }

function aplicar(escolha: Escolha) {
  const alvo = DATA_THEME[escolha]
  const raiz = document.documentElement

  if (alvo === null) {
    delete raiz.dataset.theme
  } else {
    raiz.dataset.theme = alvo
  }

  // A `<meta name="theme-color">` do `viewport` é por `@media`; no modo sistema ela já resolve
  // sozinha. Na escolha explícita, reescreve para a cor combinar com o que está na tela.
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
  if (meta && alvo) meta.setAttribute('content', COR_DA_BARRA[alvo])
}

export default function SeletorDeTema() {
  // SSR não conhece o `localStorage`; nasce em `sistema` e o efeito corrige no cliente. Sem
  // `suppressHydrationWarning` porque o texto do botão ativo é o único que muda, e ele não está
  // no HTML do servidor de um jeito que o React compare (o `aria-selected` muda, não o conteúdo).
  const [escolha, setEscolha] = useState<Escolha>('sistema')

  useEffect(() => {
    try {
      const salvo = localStorage.getItem('ciclo-tema')
      if (salvo === 'claro' || salvo === 'escuro') setEscolha(salvo)
    } catch {
      // storage indisponível (aba anônima, quota) — fica em `sistema`, que é o padrão seguro.
    }
  }, [])

  function trocar(valor: string) {
    const nova = valor as Escolha
    setEscolha(nova)
    aplicar(nova)
    try {
      if (nova === 'sistema') localStorage.removeItem('ciclo-tema')
      else localStorage.setItem('ciclo-tema', nova)
    } catch {
      // não conseguiu gravar: o tema vale para esta sessão e volta ao padrão no próximo acesso.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-corpo font-semibold">Tema</p>
        <p className="text-secundario text-txt-2">
          No automático, segue o aparelho: claro de dia, escuro de noite, se o sistema estiver assim.
        </p>
      </div>
      <Segmented segmentos={SEGMENTOS} valor={escolha} aoTrocar={trocar} rotulo="Tema do aplicativo" />
    </div>
  )
}
