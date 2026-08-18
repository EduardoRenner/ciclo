import { describe, expect, it } from 'vitest'

import { proximosEstados, transicaoValida, type EstadoAgendamento } from '@/core/scheduling/state'

const TODOS: EstadoAgendamento[] = ['pending', 'confirmed', 'arrived', 'done', 'no_show', 'canceled', 'expired']

/** As únicas transições permitidas, lidas direto do diagrama de §6. Serve de gabarito para o teste exaustivo. */
const PERMITIDAS = new Set([
  'pending>confirmed',
  'pending>canceled',
  'pending>expired',
  'confirmed>arrived',
  'confirmed>no_show',
  'confirmed>canceled',
  'arrived>done',
])

describe('transicaoValida — teste exaustivo (§6 pede isso)', () => {
  for (const de of TODOS) {
    for (const para of TODOS) {
      const esperado = PERMITIDAS.has(`${de}>${para}`)
      it(`${de} → ${para} é ${esperado ? 'permitida' : 'recusada'}`, () => {
        expect(transicaoValida(de, para)).toBe(esperado)
      })
    }
  }

  it('nenhum estado transiciona para si mesmo', () => {
    for (const estado of TODOS) expect(transicaoValida(estado, estado)).toBe(false)
  })

  it('done, no_show, canceled e expired são terminais — nenhuma saída', () => {
    for (const terminal of ['done', 'no_show', 'canceled', 'expired'] as const) {
      expect(proximosEstados(terminal)).toEqual([])
    }
  })

  it('depois de arrived só existe done — nunca volta para canceled', () => {
    expect(proximosEstados('arrived')).toEqual(['done'])
  })
})
