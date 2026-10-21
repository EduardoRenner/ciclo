import { describe, expect, it } from 'vitest'

import { iconesDaBarraParaFundo } from '@/core/plataforma/barra-de-status'

/** docs/98-aprimoramento/11 LOJA-30: as duas paletas reais de `globals.css`, mais os extremos. */
describe('cor dos ícones da barra de status', () => {
  it('tema escuro (#0d0c0c): ícones claros', () => {
    expect(iconesDaBarraParaFundo(0x0d, 0x0c, 0x0c)).toBe('claros')
  })

  it('tema claro (#faf8f5): ícones escuros', () => {
    expect(iconesDaBarraParaFundo(0xfa, 0xf8, 0xf5)).toBe('escuros')
  })

  it('preto e branco puros', () => {
    expect(iconesDaBarraParaFundo(0, 0, 0)).toBe('claros')
    expect(iconesDaBarraParaFundo(255, 255, 255)).toBe('escuros')
  })

  it('cor de salão média decide pelo contraste, não pela metade da escala', () => {
    // #767676 é o cinza mais claro com 4,5:1 contra branco; contra preto dá 4,7:1, então os escuros ganham.
    expect(iconesDaBarraParaFundo(0x76, 0x76, 0x76)).toBe('escuros')
    // Vermelho de marca saturado: escuro o bastante para o branco ganhar.
    expect(iconesDaBarraParaFundo(0xb0, 0x1e, 0x1e)).toBe('claros')
  })
})
