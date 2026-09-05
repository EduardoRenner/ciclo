import { describe, expect, it } from 'vitest'

import { DIAS_ALERTA_VENCIMENTO, venceEmBreve } from '@/core/pacotes/vencimento'

/**
 * "Vencendo em breve" tinha só o teto da janela, nunca o piso.
 *
 * A condição era `dias <= 15`. Um pacote vencido há cem dias devolve `dias = -100`, que também é
 * `<= 15` — então a marca ficava verdadeira **para sempre** depois do vencimento, desde que
 * sobrasse sessão. E sobrar sessão é justamente o caso interessante: pacote esgotado a regra já
 * excluía por outro caminho.
 *
 * Latente hoje, e isso está dito no commit: nenhuma tela lê `expiringSoon`, e
 * `pacotesAVencerEmBreve` não tem consumidor. O valor errado viaja só no formato da resposta de
 * `GET /api/v1/packages`. Quem for construir o alerta de pacotes é quem pagaria — encontraria a
 * lista de "vencendo" contaminada por pacotes mortos há meses, misturados com os que vencem
 * semana que vem, e não teria motivo para desconfiar.
 */
describe('venceEmBreve', () => {
  it('avisa dentro da janela, incluindo as duas pontas', () => {
    expect(venceEmBreve(DIAS_ALERTA_VENCIMENTO, 2)).toBe(true)
    expect(venceEmBreve(1, 2)).toBe(true)
    // Vence HOJE ainda é aviso: é o último dia em que dá para usar.
    expect(venceEmBreve(0, 2)).toBe(true)
  })

  it('não avisa antes da janela começar', () => {
    expect(venceEmBreve(DIAS_ALERTA_VENCIMENTO + 1, 2)).toBe(false)
    expect(venceEmBreve(200, 2)).toBe(false)
  })

  it('pacote JÁ VENCIDO não é "vencendo em breve" — o defeito que este arquivo existe para travar', () => {
    /*
     * O caso que o teto sozinho deixava passar. `-1` é o dia seguinte ao vencimento; `-100` é
     * qualquer tempo depois. Os dois satisfazem `<= 15`.
     */
    expect(venceEmBreve(-1, 2)).toBe(false)
    expect(venceEmBreve(-100, 5)).toBe(false)
  })

  it('sem validade cadastrada não há o que avisar', () => {
    expect(venceEmBreve(null, 5)).toBe(false)
  })

  it('pacote sem sessão sobrando não avisa, mesmo dentro da janela', () => {
    // Vencer não importa para quem já gastou tudo — não há valor a perder.
    expect(venceEmBreve(3, 0)).toBe(false)
    expect(venceEmBreve(3, -1)).toBe(false)
  })
})
