import { describe, expect, it } from 'vitest'

import { avaliarAlertas, type PerguntaAnamnese } from '@/core/vault/anamnese'

const PERGUNTAS: PerguntaAnamnese[] = [
  { id: 'pregnant', label: 'Está gestante ou amamentando?', type: 'bool' },
  { id: 'eye_surgery', label: 'Fez cirurgia ocular nos últimos 6 meses?', type: 'bool', alert_if: true },
  { id: 'glue_allergy', label: 'Já teve reação a cola de cílios?', type: 'bool', alert_if: true },
]

describe('avaliarAlertas — TICKET-050', () => {
  it('nenhuma resposta de alerta: hasAlert false, alertLabel null', () => {
    const r = avaliarAlertas(PERGUNTAS, { pregnant: true, eye_surgery: false, glue_allergy: false })
    expect(r).toEqual({ hasAlert: false, alertLabel: null })
  })

  it('uma resposta bate com alert_if: acende o alerta com rótulo genérico', () => {
    const r = avaliarAlertas(PERGUNTAS, { eye_surgery: true })
    expect(r.hasAlert).toBe(true)
    expect(r.alertLabel).toBe('Atenção')
  })

  it('o rótulo nunca reproduz o texto da pergunta (nunca vaza diagnóstico)', () => {
    const r = avaliarAlertas(PERGUNTAS, { glue_allergy: true })
    expect(r.alertLabel).not.toContain('cola')
    expect(r.alertLabel).not.toContain('cirurgia')
  })

  it('pergunta sem alert_if nunca acende alerta, mesmo respondida', () => {
    const r = avaliarAlertas(PERGUNTAS, { pregnant: true })
    expect(r.hasAlert).toBe(false)
  })

  it('resposta que não bate com alert_if (false quando alert_if é true) não acende', () => {
    const r = avaliarAlertas(PERGUNTAS, { eye_surgery: false, glue_allergy: false })
    expect(r.hasAlert).toBe(false)
  })

  it('formulário sem nenhuma resposta: nada acende', () => {
    expect(avaliarAlertas(PERGUNTAS, {})).toEqual({ hasAlert: false, alertLabel: null })
  })
})
