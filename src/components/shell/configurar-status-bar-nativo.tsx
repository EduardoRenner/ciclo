'use client'

import { useEffect } from 'react'

import { usePathname } from 'next/navigation'

import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

import { iconesDaBarraParaFundo } from '@/core/plataforma/barra-de-status'

/**
 * T4 (docs/64-APP-STORE-CAPACITOR-PLANO.md §0.4, corrigido depois do primeiro teste em emulador
 * de verdade — `docs/DECISOES.md` 2026-09-15): a primeira versão chamava `setOverlaysWebView(false)`
 * + `setBackgroundColor` esperando pintar a faixa da barra de escuro. Não fez nada visível —
 * `android/variables.gradle` mira `targetSdkVersion 36` (Android 15+), que **força** layout
 * edge-to-edge: a partir daí `Window.setStatusBarColor`/`overlaysWebView(false)` deixam de ter
 * efeito, e o app SEMPRE desenha por baixo da barra, ponto. O jeito certo nesse modelo não é pintar
 * a barra — é deixar o CONTEÚDO se estender por baixo dela (que já é o padrão do Capacitor 8,
 * plugin interno `SystemBars`) e deixar o fundo da própria página aparecer pela área transparente.
 * `viewport-fit: cover` (já configurado no layout raiz) cuida da safe-area via
 * `env(safe-area-inset-top)` do lado do CSS. Sobra a cor dos ÍCONES da barra (hora, bateria, sinal),
 * a única parte que ainda é uma chamada nativa de verdade nesse modelo.
 *
 * docs/98-aprimoramento/11 LOJA-30: os ícones eram sempre brancos (`Style.Dark`), e o painel nasce
 * CLARO desde 23/09. Agora a cor sai do que está pintado debaixo da barra, medido de novo a cada troca de
 * tela, de tema (`data-theme` no `#raiz-do-tema`) e de tema do aparelho (o "Automático").
 *
 * Fora do app nativo isto nunca roda: `isNativePlatform()` é `false` no navegador comum, e o
 * `import` de `@capacitor/status-bar` não faz chamada nenhuma sozinho.
 */

/** Normaliza qualquer cor CSS (rgb, oklch, color-mix) pelo próprio navegador, num pixel de canvas. */
function paraRgba(cor: string, ctx: CanvasRenderingContext2D): [number, number, number, number] | null {
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = '#000'
  ctx.fillStyle = cor
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  return r === undefined || g === undefined || b === undefined || a === undefined ? null : [r, g, b, a / 255]
}

/** A primeira cor de fundo opaca de quem está desenhado na faixa da barra, subindo pelos ancestrais. */
function corDebaixoDaBarra(ctx: CanvasRenderingContext2D): [number, number, number] | null {
  let el: Element | null = document.elementFromPoint(window.innerWidth / 2, 1)
  while (el) {
    const rgba = paraRgba(getComputedStyle(el).backgroundColor, ctx)
    if (rgba && rgba[3] >= 0.5) return [rgba[0], rgba[1], rgba[2]]
    el = el.parentElement
  }
  return null
}

export default function ConfigurarStatusBarNativo() {
  const caminho = usePathname()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    let aplicado: Style | null = null
    let quadro = 0

    const aplicar = () => {
      cancelAnimationFrame(quadro)
      // Depois do próximo quadro: a tela nova (ou o tema novo) já está pintada quando a cor é lida.
      quadro = requestAnimationFrame(() => {
        const rgb = ctx ? corDebaixoDaBarra(ctx) : null
        const estilo = rgb && iconesDaBarraParaFundo(...rgb) === 'escuros' ? Style.Light : Style.Dark
        if (estilo === aplicado) return
        aplicado = estilo
        StatusBar.setStyle({ style: estilo }).catch(() => {})
      })
    }

    aplicar()
    const tema = new MutationObserver(aplicar)
    tema.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-theme'] })
    const aparelho = window.matchMedia('(prefers-color-scheme: dark)')
    aparelho.addEventListener('change', aplicar)
    return () => {
      cancelAnimationFrame(quadro)
      tema.disconnect()
      aparelho.removeEventListener('change', aplicar)
    }
  }, [caminho])

  return null
}
