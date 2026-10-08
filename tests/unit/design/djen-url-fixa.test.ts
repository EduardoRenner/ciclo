import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { DJEN_BASE, urlDaConsulta } from '@/server/advocacia/djen'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/101 anexo 02 A11. A captura de intimações faz requisição de saída a cada 15 minutos para todo
 * escritório. Se o endereço viesse de configuração ou de dado (variável de ambiente, coluna, corpo de
 * requisição), quem mexesse nesse valor apontaria o servidor para onde quisesse (SSRF), com o
 * cabeçalho e o tempo de espera do CICLO. Por isso a base é literal e o redirecionamento é recusado.
 */
const FONTE = semComentarios(readFileSync('src/server/advocacia/djen.ts', 'utf8'))

describe('o cliente do DJEN só fala com o DJEN', () => {
  it('a base é o endereço oficial, escrito no código', () => {
    expect(DJEN_BASE).toBe('https://comunicaapi.pje.jus.br')
    expect(/export const DJEN_BASE = "https:\/\/comunicaapi\.pje\.jus\.br";/.test(FONTE)).toBe(true)
  })

  it('nenhuma leitura de ambiente no cliente', () => {
    expect(/process\.env/.test(FONTE), 'o endereço do DJEN passou a vir de configuração').toBe(false)
  })

  it('redirecionamento é recusado (seguir um levaria a captura para outro host)', () => {
    expect(/redirect: "error"/.test(FONTE)).toBe(true)
  })

  it('a URL montada sempre começa pela base, por um dia só', () => {
    const url = urlDaConsulta({ tipo: 'oab', numero: '12345', uf: 'SC' }, '2026-10-05', 1)
    expect(url.startsWith(`${DJEN_BASE}/api/v1/comunicacao?`)).toBe(true)
    expect(url).toContain('dataDisponibilizacaoInicio=2026-10-05')
    expect(url).toContain('dataDisponibilizacaoFim=2026-10-05')
  })
})
