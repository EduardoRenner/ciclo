import { describe, expect, it } from 'vitest'

import { proximoPasso, type PendenciaDoResumo, type PrazoDoResumo } from '@/core/advocacia/resumo-do-caso'

const HOJE = '2026-10-08'
const prazo = (p: Partial<PrazoDoResumo>): PrazoDoResumo => ({ titulo: 'Manifestação', tipo: 'fatal', venceEm: '2026-10-20', internoEm: '2026-10-16', aberto: true, ...p })
const pend = (p: Partial<PendenciaDoResumo>): PendenciaDoResumo => ({ titulo: 'Matrícula do imóvel', quemDeve: 'cliente', venceEm: '2026-10-12', esperando: true, ...p })

describe('proximoPasso', () => {
  it('nada aberto: sem próximo passo', () => {
    expect(proximoPasso([prazo({ aberto: false })], [pend({ esperando: false })], HOJE)).toBeNull()
  })

  it('a pendência mais cedo ganha do prazo mais tarde, e diz de quem é', () => {
    expect(proximoPasso([prazo({})], [pend({})], HOJE)).toMatchObject({ texto: 'Matrícula do imóvel até 12/10', de: 'cliente', atrasado: false })
  })

  it('prazo fatal conta pelo dia INTERNO e mostra os dois', () => {
    const p = proximoPasso([prazo({ internoEm: '2026-10-09' })], [pend({})], HOJE)
    expect(p).toMatchObject({ texto: 'Manifestação: fazer até 09/10 · fatal 20/10', de: 'escritorio', ate: '2026-10-09', fatal: true })
  })

  it('no mesmo dia, o prazo vem antes da pendência', () => {
    expect(proximoPasso([prazo({ internoEm: '2026-10-12' })], [pend({})], HOJE)?.fatal).toBe(true)
  })

  it('atrasado quando o dia já passou', () => {
    expect(proximoPasso([], [pend({ venceEm: '2026-10-01' })], HOJE)?.atrasado).toBe(true)
  })

  it('pendência sem data fica atrás de qualquer coisa com data', () => {
    expect(proximoPasso([], [pend({ titulo: 'Sem data', venceEm: null }), pend({ titulo: 'Com data', venceEm: '2026-12-01' })], HOJE)?.texto).toBe('Com data até 01/12')
  })
})
