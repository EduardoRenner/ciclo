import { describe, expect, it } from 'vitest'

import { decodificarTexto } from '@/core/text/decodificar-texto'

/**
 * BL-51 (2026-09-28, medido): o CSV que o Excel em português salva é Windows-1252. Lido como UTF-8,
 * "João Conceição" virava "Jo�o Concei��o" — e era assim que ficava gravado no nome da cliente.
 */

/** "João Conceição" em Windows-1252: ã = 0xE3, ç = 0xE7. */
const WIN1252 = Uint8Array.from([0x4a, 0x6f, 0xe3, 0x6f, 0x20, 0x43, 0x6f, 0x6e, 0x63, 0x65, 0x69, 0xe7, 0xe3, 0x6f])

describe('decodificarTexto', () => {
  it('lê arquivo Windows-1252 (o "CSV" do Excel em português) sem corromper acento', () => {
    expect(decodificarTexto(WIN1252)).toBe('João Conceição')
  })

  it('não estraga arquivo que já é UTF-8 com acento', () => {
    expect(decodificarTexto(new TextEncoder().encode('João Conceição'))).toBe('João Conceição')
  })

  it('aceita ArrayBuffer, que é o que File.arrayBuffer() devolve', () => {
    const buffer = WIN1252.buffer.slice(WIN1252.byteOffset, WIN1252.byteOffset + WIN1252.byteLength)
    expect(decodificarTexto(buffer)).toBe('João Conceição')
  })

  it('texto sem acento sai igual nos dois casos', () => {
    expect(decodificarTexto(new TextEncoder().encode('Nome;Telefone'))).toBe('Nome;Telefone')
  })
})

describe('planilhaBinaria (docs/83 P4)', () => {
  it('reconhece .xlsx (zip) e .xls (OLE) pelo começo do arquivo', async () => {
    const { planilhaBinaria } = await import('@/core/text/decodificar-texto')
    expect(planilhaBinaria(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]))).toBe('xlsx')
    expect(planilhaBinaria(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]))).toBe('xls')
  })

  it('CSV de verdade (inclusive Win-1252 e com BOM) não é confundido com planilha', async () => {
    const { planilhaBinaria } = await import('@/core/text/decodificar-texto')
    expect(planilhaBinaria(new TextEncoder().encode('Nome;Telefone'))).toBeNull()
    expect(planilhaBinaria(WIN1252)).toBeNull()
    expect(planilhaBinaria(new TextEncoder().encode('﻿nome,telefone'))).toBeNull()
    // Um CSV que começa com "PK" (nome de gente) também não: o zip exige os bytes 03 04 depois.
    expect(planilhaBinaria(new TextEncoder().encode('PK Silva;11'))).toBeNull()
  })
})
