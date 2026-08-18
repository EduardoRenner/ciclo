import { afterEach, describe, expect, it } from 'vitest'

import { hashTelefone, normalizarTelefoneBR } from '@/server/services/telefone'

describe('normalizarTelefoneBR', () => {
  it('celular com DDD e sem +55 vira E.164', () => {
    expect(normalizarTelefoneBR('11987654321')).toBe('+5511987654321')
  })

  it('aceita com formatação (parênteses, espaço, hífen)', () => {
    expect(normalizarTelefoneBR('(11) 98765-4321')).toBe('+5511987654321')
  })

  it('já em E.164 passa direto', () => {
    expect(normalizarTelefoneBR('+5511987654321')).toBe('+5511987654321')
  })

  it('fixo (sem o 9) também é válido', () => {
    expect(normalizarTelefoneBR('1130304050')).toBe('+551130304050')
  })

  it('D49: rejeita DDD inexistente, mesmo quando o formato passaria', () => {
    // libphonenumber-js sozinho aceita: valida o formato (2 dígitos + celular
    // de 9), não se o DDD foi de fato atribuído pela Anatel. 10, 20 e 30
    // nunca existiram.
    expect(normalizarTelefoneBR('10987654321')).toBeNull()
    expect(normalizarTelefoneBR('20987654321')).toBeNull()
    expect(normalizarTelefoneBR('30987654321')).toBeNull()
  })

  it('aceita DDDs reais de cada região', () => {
    expect(normalizarTelefoneBR('11987654321')).toBe('+5511987654321') // SP
    expect(normalizarTelefoneBR('21987654321')).toBe('+5521987654321') // RJ
    expect(normalizarTelefoneBR('85987654321')).toBe('+5585987654321') // CE
    expect(normalizarTelefoneBR('98987654321')).toBe('+5598987654321') // MA
  })

  it('rejeita número curto demais ou vazio', () => {
    expect(normalizarTelefoneBR('123')).toBeNull()
    expect(normalizarTelefoneBR('')).toBeNull()
  })
})

describe('hashTelefone', () => {
  const original = process.env.PHONE_HASH_SALT
  afterEach(() => {
    if (original === undefined) delete process.env.PHONE_HASH_SALT
    else process.env.PHONE_HASH_SALT = original
  })

  it('é determinístico para o mesmo número e sal', () => {
    process.env.PHONE_HASH_SALT = 'sal-de-teste'
    expect(hashTelefone('+5511987654321')).toBe(hashTelefone('+5511987654321'))
  })

  it('números diferentes geram hashes diferentes', () => {
    process.env.PHONE_HASH_SALT = 'sal-de-teste'
    expect(hashTelefone('+5511987654321')).not.toBe(hashTelefone('+5511987654322'))
  })

  it('sem PHONE_HASH_SALT, estoura em vez de hashear sem sal', () => {
    delete process.env.PHONE_HASH_SALT
    expect(() => hashTelefone('+5511987654321')).toThrow('PHONE_HASH_SALT ausente')
  })
})
