import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { estadoDoBotao, posicaoDaBolha } from '@/core/ui/botao-travado'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/102 M1.4: o motivo do botão travado ficava só no `title` (que `pointer-events: none` impedia de
 * aparecer) e no texto de leitor de tela. Medido em /admin/casos/novo em 2026-10-08: `elementFromPoint`
 * no centro do botão devolvia o formulário. Agora o toque mostra o motivo.
 */
describe('estadoDoBotao', () => {
  it('travado com motivo: aria-disabled, recebe o toque e explica', () => {
    expect(estadoDoBotao({ disabled: true, motivo: 'Escolha o cliente.' })).toEqual({ disabledNativo: false, ariaDisabled: true, explicaNoToque: true })
  })

  it('carregando: disabled nativo, mesmo com motivo (o spinner explica)', () => {
    expect(estadoDoBotao({ disabled: true, carregando: true, motivo: 'x' })).toEqual({ disabledNativo: true, ariaDisabled: false, explicaNoToque: false })
  })

  it('travado sem motivo (ou só espaço): disabled nativo', () => {
    expect(estadoDoBotao({ disabled: true })).toEqual({ disabledNativo: true, ariaDisabled: false, explicaNoToque: false })
    expect(estadoDoBotao({ disabled: true, motivo: '  ' }).disabledNativo).toBe(true)
  })

  it('livre: nada travado', () => {
    expect(estadoDoBotao({ motivo: 'sobrou de antes' })).toEqual({ disabledNativo: false, ariaDisabled: false, explicaNoToque: false })
  })
})

describe('posicaoDaBolha', () => {
  it('embaixo do botão quando cabe; em cima quando não cabe', () => {
    expect(posicaoDaBolha({ top: 100, bottom: 148 }, 812)).toEqual({ top: 156 })
    expect(posicaoDaBolha({ top: 740, bottom: 788 }, 812)).toEqual({ bottom: 80 })
  })
})

describe('o Button usa a regra (e não volta a esconder o evento)', () => {
  const fonte = semComentarios(readFileSync('src/components/ui/button.tsx', 'utf8'))

  it('decide pelo estadoDoBotao e liga o aria-disabled', () => {
    expect(fonte).toMatch(/estadoDoBotao\(\{/)
    expect(fonte).toMatch(/aria-disabled=\{estado\.ariaDisabled/)
    expect(fonte).toMatch(/disabled=\{estado\.disabledNativo\}/)
  })

  it('o toque no travado previne a ação e mostra a bolha com o motivo', () => {
    expect(fonte).toMatch(/if \(estado\.explicaNoToque\) \{\s*e\.preventDefault\(\)/)
    expect(fonte).toMatch(/role="status"[\s\S]{0,400}\{motivoDesabilitado\}/)
  })

  it('o estilo de travado não tira os eventos do aria-disabled', () => {
    expect(fonte).not.toMatch(/aria-disabled:pointer-events-none/)
  })
})
