'use client'

import { useEffect, useState } from 'react'

import Segmented from '@/components/ui/segmented'

/**
 * Claro, escuro ou o que o aparelho pedir. Pedido do dono em 2026-09-10.
 *
 * Grava um **cookie** `ciclo-tema` (não `localStorage`): só o cookie chega ao servidor, e é o
 * `admin/layout.tsx` que, lendo-o, embrulha o painel num `<div data-theme>` já no HTML — então a
 * escolha não pisca na próxima carga. Aqui a troca também é aplicada AO VIVO no mesmo `<div>`
 * (`#raiz-do-tema`), sem recarregar.
 *
 * Valores: `claro` | `escuro` | ausente (= automático, o `@media` do CSS decide).
 */

type Escolha = 'sistema' | 'claro' | 'escuro'

const SEGMENTOS = [
  { valor: 'sistema', rotulo: 'Automático' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
]

/** O que o `data-theme` do wrapper recebe. `globals.css` conhece estes três. */
const DATA_THEME: Record<Escolha, 'sistema' | 'light' | 'dark'> = {
  sistema: 'sistema',
  claro: 'light',
  escuro: 'dark',
}

const UM_ANO = 60 * 60 * 24 * 365

function lerCookie(): Escolha {
  const m = document.cookie.match(/(?:^|;\s*)ciclo-tema=(claro|escuro)/)
  return m ? (m[1] as Escolha) : 'sistema'
}

function aplicar(escolha: Escolha) {
  document.getElementById('raiz-do-tema')?.setAttribute('data-theme', DATA_THEME[escolha])
  if (escolha === 'sistema') {
    document.cookie = `ciclo-tema=; path=/; max-age=0; samesite=lax`
  } else {
    document.cookie = `ciclo-tema=${escolha}; path=/; max-age=${UM_ANO}; samesite=lax`
  }
}

export default function SeletorDeTema() {
  // SSR não lê o cookie do lado do cliente; nasce em `sistema` e o efeito corrige. O wrapper do
  // `admin/layout` já veio com o valor certo do servidor, então não há piscada — só o botão ativo
  // se acerta um frame depois.
  const [escolha, setEscolha] = useState<Escolha>('sistema')

  useEffect(() => {
    setEscolha(lerCookie())
  }, [])

  function trocar(valor: string) {
    const nova = valor as Escolha
    setEscolha(nova)
    aplicar(nova)
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-corpo font-semibold">Tema</p>
        <p className="text-secundario text-txt-2">
          No automático, segue o aparelho: claro se o sistema estiver no claro, escuro se estiver no escuro.
        </p>
      </div>
      <Segmented segmentos={SEGMENTOS} valor={escolha} aoTrocar={trocar} rotulo="Tema do aplicativo" />
    </div>
  )
}
