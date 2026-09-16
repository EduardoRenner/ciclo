'use client'

import { useEffect } from 'react'

import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/**
 * T4 (docs/64-APP-STORE-CAPACITOR-PLANO.md §0.4, corrigido depois do primeiro teste em emulador
 * de verdade — `docs/DECISOES.md` 2026-09-15): a primeira versão chamava `setOverlaysWebView(false)`
 * + `setBackgroundColor` esperando pintar a faixa da barra de escuro. Não fez nada visível —
 * `android/variables.gradle` mira `targetSdkVersion 36` (Android 15+), que **força** layout
 * edge-to-edge: a partir daí `Window.setStatusBarColor`/`overlaysWebView(false)` deixam de ter
 * efeito, e o app SEMPRE desenha por baixo da barra, ponto. O jeito certo nesse modelo não é pintar
 * a barra — é deixar o CONTEÚDO se estender por baixo dela (que já é o padrão do Capacitor 8,
 * plugin interno `SystemBars`) e confiar que o fundo escuro da própria página (`body { background:
 * var(--bg) }`, `#0d0c0c`) aparece através da área transparente. `viewport-fit: cover` (já
 * configurado no layout raiz) cuida da safe-area via `env(safe-area-inset-top)` do lado do CSS.
 * Sobra só `Style.Dark`, que pinta os ÍCONES da barra (hora, bateria, sinal) de branco — a única
 * parte que ainda é uma chamada nativa de verdade nesse modelo.
 *
 * Fora do app nativo isto nunca roda: `isNativePlatform()` é `false` no navegador comum, e o
 * `import` de `@capacitor/status-bar` não faz chamada nenhuma sozinho.
 */
export default function ConfigurarStatusBarNativo() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  }, [])

  return null
}
