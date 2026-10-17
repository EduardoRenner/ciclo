import { describe, expect, it } from 'vitest'

import { montarPagamentosPorOutroMeio, visitaSemVendaAvulsa } from '@/core/attribution/venda-avulsa'

const visita = (dia: string, id = 'v1') => ({ id, clientId: 'c1', serviceId: 's1', dia })

describe('visitaSemVendaAvulsa (APR-014)', () => {
  it('sessão de pacote usada na visita: sem venda avulsa — e continua assim depois de o pacote acabar', () => {
    const pagos = montarPagamentosPorOutroMeio([{ appointmentId: 'v1', clientId: 'c1', serviceId: 's1', dia: '2026-09-01' }], [])
    expect(visitaSemVendaAvulsa(visita('2026-09-01'), pagos)).toBe(true)
    // A regra não lê saldo: nada aqui muda quando a última sessão é consumida.
  })

  it('uso sem vínculo com horário conta no mesmo dia, mesmo cliente e serviço — e só nele', () => {
    const pagos = montarPagamentosPorOutroMeio([{ appointmentId: null, clientId: 'c1', serviceId: 's1', dia: '2026-09-01' }], [])
    expect(visitaSemVendaAvulsa(visita('2026-09-01'), pagos)).toBe(true)
    expect(visitaSemVendaAvulsa(visita('2026-09-02'), pagos)).toBe(false)
    expect(visitaSemVendaAvulsa({ ...visita('2026-09-01'), serviceId: 's2' }, pagos)).toBe(false)
  })

  it('clube: só dentro do período da assinatura', () => {
    const pagos = montarPagamentosPorOutroMeio([], [{ clientId: 'c1', inicio: '2026-08-01', fim: '2026-09-15' }])
    expect(visitaSemVendaAvulsa(visita('2026-07-31'), pagos)).toBe(false)
    expect(visitaSemVendaAvulsa(visita('2026-08-01'), pagos)).toBe(true)
    expect(visitaSemVendaAvulsa(visita('2026-09-14'), pagos)).toBe(true)
    expect(visitaSemVendaAvulsa(visita('2026-09-15'), pagos)).toBe(false)
  })

  it('assinatura sem fim cobre daí em diante; sem nada, é venda avulsa', () => {
    expect(visitaSemVendaAvulsa(visita('2027-01-01'), montarPagamentosPorOutroMeio([], [{ clientId: 'c1', inicio: '2026-08-01', fim: null }]))).toBe(true)
    expect(visitaSemVendaAvulsa(visita('2026-09-01'), montarPagamentosPorOutroMeio([], []))).toBe(false)
  })
})
