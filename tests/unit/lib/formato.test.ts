import { describe, expect, it } from 'vitest'

import { formatarTelefone, mascaraTelefone } from '@/lib/formato'

describe('formatarTelefone', () => {
  it('mostra o E.164 do banco como a profissional lê', () => {
    expect(formatarTelefone('+5511987654321')).toBe('(11) 98765-4321')
    expect(formatarTelefone('+551133334444')).toBe('(11) 3333-4444')
  })

  it('número que não é celular brasileiro aparece cru, não sumido', () => {
    // Base importada de planilha tem de tudo; esconder é pior que mostrar torto.
    expect(formatarTelefone('+351912345678')).toBe('+351912345678')
    expect(formatarTelefone(null)).toBeNull()
  })
})

describe('mascaraTelefone', () => {
  it('formata enquanto digita, sem travar em nenhum tamanho intermediário', () => {
    expect(mascaraTelefone('1')).toBe('1')
    expect(mascaraTelefone('11')).toBe('11')
    expect(mascaraTelefone('119')).toBe('(11) 9')
    expect(mascaraTelefone('11987')).toBe('(11) 987')
    expect(mascaraTelefone('1198765')).toBe('(11) 9876-5')
    expect(mascaraTelefone('11987654321')).toBe('(11) 98765-4321')
  })

  it('aceita o fixo de 8 dígitos que salão antigo ainda usa', () => {
    expect(mascaraTelefone('1133334444')).toBe('(11) 3333-4444')
  })

  it('descarta o +55 colado de um contato do WhatsApp', () => {
    expect(mascaraTelefone('+55 11 98765-4321')).toBe('(11) 98765-4321')
  })

  it('ignora o que passa de 11 dígitos em vez de deixar a máscara explodir', () => {
    expect(mascaraTelefone('119876543219999')).toBe('(11) 98765-4321')
  })

  it('é idempotente — reaplicar a máscara no valor já mascarado não muda nada', () => {
    // O componente controla o campo com a saída da própria função; sem isto o
    // valor se desfaria a cada tecla.
    expect(mascaraTelefone(mascaraTelefone('11987654321'))).toBe('(11) 98765-4321')
  })
})
