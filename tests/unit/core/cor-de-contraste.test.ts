import { describe, expect, it } from 'vitest'

import { corDeContraste, PALETA_PRESET } from '@/core/text/cor'

function luminancia(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)!
  const canal = (h: string) => {
    const c = parseInt(h, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(m[1]!) + 0.7152 * canal(m[2]!) + 0.0722 * canal(m[3]!)
}

function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}

describe('corDeContraste', () => {
  it('escolhe texto escuro sobre acento claro', () => {
    expect(corDeContraste('#f0ebe3')).toBe('#0d0c0c')
  })

  it('escolhe texto claro sobre acento escuro', () => {
    expect(corDeContraste('#1a1a2e')).toBe('#fffcf7')
  })

  it('trata hex inválido como claro, caindo no texto escuro (mesmo padrão do osso default)', () => {
    expect(corDeContraste('não é hex')).toBe('#0d0c0c')
  })

  it.each(PALETA_PRESET)('preset "$nome" ($hex) dá contraste >= 4.5:1 com o texto escolhido', ({ hex }) => {
    const texto = corDeContraste(hex)
    expect(contraste(hex, texto)).toBeGreaterThanOrEqual(4.5)
  })
})
