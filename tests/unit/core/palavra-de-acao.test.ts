import { describe, expect, it } from 'vitest'

import { acaoDoTexto } from '@/core/mensageria/palavra-de-acao'

describe('acaoDoTexto', () => {
  it('reconhece as variações de confirmar, com acento ou sem', () => {
    expect(acaoDoTexto('confirmar')).toBe('confirmar')
    expect(acaoDoTexto('Confirmar')).toBe('confirmar')
    expect(acaoDoTexto('CONFIRMAR')).toBe('confirmar')
    expect(acaoDoTexto('confirmado')).toBe('confirmar')
    expect(acaoDoTexto('confirmada')).toBe('confirmar')
  })

  it('reconhece as variações de cancelar', () => {
    expect(acaoDoTexto('cancelar')).toBe('cancelar')
    expect(acaoDoTexto('Cancelado')).toBe('cancelar')
  })

  it('tolera espaço e pontuação nas bordas, mas não no meio', () => {
    expect(acaoDoTexto('  confirmar  ')).toBe('confirmar')
    expect(acaoDoTexto('confirmar!')).toBe('confirmar')
    expect(acaoDoTexto('confirmar.')).toBe('confirmar')
  })

  it('PISO — a mensagem inteira precisa SER a palavra, não conter a palavra', () => {
    // A armadilha que um regex de prefixo cairia: "confirma" aparece na frase, mas é pergunta,
    // não confirmação. Se isto virasse 'confirmar', o cliente estaria sendo confirmado por engano
    // ao só perguntar um horário.
    expect(acaoDoTexto('confirmar às 15h seria possível?')).toBeNull()
    expect(acaoDoTexto('quero cancelar mas depois confirmo')).toBeNull()
  })

  it('texto fora do vocabulário fechado não aciona nada — "sim"/"ok" são genéricos demais', () => {
    expect(acaoDoTexto('sim')).toBeNull()
    expect(acaoDoTexto('ok')).toBeNull()
    expect(acaoDoTexto('oi, tudo bem?')).toBeNull()
    expect(acaoDoTexto('')).toBeNull()
  })
})
