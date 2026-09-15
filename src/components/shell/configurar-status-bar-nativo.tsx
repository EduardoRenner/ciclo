'use client'

import { useEffect } from 'react'

import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/**
 * T4 (docs/64-APP-STORE-CAPACITOR-PLANO.md §0.4): a barra de status por cima do WebView, branca e
 * sobrepondo o notch, é um dos jeitos mais citados de um app parecer "só o Safari por cima do
 * site" — exatamente o padrão que a diretriz 4.2 pune. `overlaysWebView(false)` reserva a faixa da
 * barra pro sistema (o `viewport-fit: cover` do layout raiz já trata a safe area do lado do CSS);
 * `Style.Dark` pinta os ícones da barra em branco, coerentes com o fundo escuro (`#0d0c0c`,
 * `viewport.themeColor`) que é o padrão do produto.
 *
 * Fora do app nativo isto nunca roda: `isNativePlatform()` é `false` no navegador comum, e o
 * `import` de `@capacitor/status-bar` não faz chamada nenhuma sozinho.
 */
export default function ConfigurarStatusBarNativo() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#0d0c0c' }).catch(() => {})
  }, [])

  return null
}
