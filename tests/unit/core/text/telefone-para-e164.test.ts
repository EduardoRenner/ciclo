import { describe, expect, it } from 'vitest'

import { telefoneParaE164 } from '@/core/text/telefone'
import { linkWhatsApp } from '@/lib/mensagens'

describe('telefone digitado vira E.164 sem duplicar o país (APR-208)', () => {
  it('celular brasileiro com e sem o país', () => {
    expect(telefoneParaE164('(11) 98765-4321')).toBe('+5511987654321')
    expect(telefoneParaE164('+55 11 98765-4321')).toBe('+5511987654321')
    expect(telefoneParaE164('55 11 98765 4321')).toBe('+5511987654321')
  })

  it('número estrangeiro não ganha 55 na frente', () => {
    expect(telefoneParaE164('+351 912 345 678')).toBe('+351912345678')
    expect(linkWhatsApp(telefoneParaE164('+351 912 345 678'), 'oi')).toBe('https://wa.me/351912345678?text=oi')
  })

  it('o link do orçamento nunca sai com 55 55', () => {
    expect(linkWhatsApp(telefoneParaE164('+55 11 98765-4321'), 'oi')).toBe('https://wa.me/5511987654321?text=oi')
  })

  it('o que não é telefone vira null (e o link cai no seletor de contato)', () => {
    expect(telefoneParaE164('')).toBeNull()
    expect(telefoneParaE164('1234')).toBeNull()
  })
})
