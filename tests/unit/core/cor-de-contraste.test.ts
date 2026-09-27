import { describe, expect, it } from 'vitest'

import { acentoNoTemaClaro, corDeContraste, corLegivelNoClaro, PALETA_PRESET } from '@/core/text/cor'

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

describe('acentoNoTemaClaro (página pública clara)', () => {
  const FUNDO = '#faf8f5'

  it('osso de fábrica não sobrescreve nada: valem os tokens do tema claro', () => {
    expect(acentoNoTemaClaro('#f0ebe3')).toBeNull()
    expect(acentoNoTemaClaro('#F0EBE3')).toBeNull()
    expect(acentoNoTemaClaro('não é hex')).toBeNull()
  })

  it.each(PALETA_PRESET.filter((p) => p.hex !== '#f0ebe3'))('preset "$nome" ($hex): preenchimento 3:1 e texto 4.5:1 sobre o fundo claro', ({ hex }) => {
    const a = acentoNoTemaClaro(hex)
    expect(a, 'preset escolhido virou "sem acento"').not.toBeNull()
    expect(contraste(a!.acc, FUNDO), `acc de ${hex}`).toBeGreaterThanOrEqual(3)
    expect(contraste(a!.acc2, FUNDO), `acc2 de ${hex}`).toBeGreaterThanOrEqual(4.5)
    expect(contraste(a!.acc, a!.onAcc), `texto sobre o botão de ${hex}`).toBeGreaterThanOrEqual(4.5)
  })

  it('cor que já tem contraste não é alterada (a marca do dono só muda quando precisa)', () => {
    expect(corLegivelNoClaro('#0b7d6f', 4.5)).toBe('#0b7d6f')
    expect(acentoNoTemaClaro('#1a1a2e')?.acc).toBe('#1a1a2e')
  })

  it('controle: o defeito antigo (os presets crus sobre o fundo claro) de fato reprovava', () => {
    // Se isto passar a dar >= 4.5, a guarda acima deixou de provar alguma coisa.
    const cruas = PALETA_PRESET.filter((p) => contraste(p.hex, FUNDO) < 4.5)
    expect(cruas.length, 'nenhum preset reprovava: o cenário não foi montado').toBeGreaterThanOrEqual(4)
  })
})
