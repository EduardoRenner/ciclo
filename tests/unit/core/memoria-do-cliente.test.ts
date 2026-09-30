import { describe, expect, it } from 'vitest'

import { frasesDaMemoria, memoriaDoCliente, type AtendimentoConcluido } from '@/core/crm/memoria-do-cliente'

// 2026-09-01 é terça.
const TERCAS = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']
const com = (dias: string[], profissional: string | null = 'Ana'): AtendimentoConcluido[] => dias.map((dia) => ({ dia, profissional }))

describe('memória do cliente — docs/84 P4', () => {
  it('diz o dia da semana, com quem e a faixa, cada um com a contagem', () => {
    const m = memoriaDoCliente(com(TERCAS), { variosProfissionais: true })
    expect(frasesDaMemoria(m)).toEqual([
      'Costuma vir às terças (5 de 5 visitas).',
      'Sempre com Ana (5 visitas).',
      'Costuma voltar em 7 dias.',
    ])
  })

  it('abaixo do piso não afirma nada — 3 visitas não são hábito de dia', () => {
    const m = memoriaDoCliente(com(TERCAS.slice(0, 3)), { variosProfissionais: true })
    expect(m.diaDaSemana).toBeNull()
    expect(m.faixaDeRetorno).toBeNull()
    // Profissional tem piso próprio, de 3.
    expect(m.profissional).toEqual({ nome: 'Ana', vezes: 3, de: 3 })
  })

  it('empate de dia não escolhe por ela', () => {
    // 2 terças e 2 sábados.
    const m = memoriaDoCliente(com(['2026-09-01', '2026-09-05', '2026-09-08', '2026-09-12']), { variosProfissionais: true })
    expect(m.diaDaSemana).toBeNull()
  })

  it('dia comum em menos da metade das visitas não é costume', () => {
    // terça, quarta, quinta, sexta, terça: 2 de 5.
    const m = memoriaDoCliente(com(['2026-09-01', '2026-09-09', '2026-09-17', '2026-09-25', '2026-09-29']), { variosProfissionais: true })
    expect(m.diaDaSemana).toBeNull()
  })

  it('sábado e domingo levam "aos"', () => {
    const sabados = ['2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26']
    expect(frasesDaMemoria(memoriaDoCliente(com(sabados), { variosProfissionais: false }))[0]).toBe('Costuma vir aos sábados (4 de 4 visitas).')
  })

  it('negócio de uma pessoa só não ganha "sempre com a dona"', () => {
    expect(memoriaDoCliente(com(TERCAS), { variosProfissionais: false }).profissional).toBeNull()
  })

  it('profissional abaixo de 60% não vira "quase sempre"', () => {
    const atend: AtendimentoConcluido[] = [
      { dia: '2026-09-01', profissional: 'Ana' },
      { dia: '2026-09-08', profissional: 'Ana' },
      { dia: '2026-09-15', profissional: 'Bia' },
      { dia: '2026-09-22', profissional: 'Caio' },
    ]
    expect(memoriaDoCliente(atend, { variosProfissionais: true }).profissional).toBeNull()
    // 3 de 4 = 75% passa, e a frase diz "quase", não "sempre".
    atend[3] = { dia: '2026-09-22', profissional: 'Ana' }
    expect(frasesDaMemoria(memoriaDoCliente(atend, { variosProfissionais: true }))).toContain('Quase sempre com Ana (3 de 4 visitas).')
  })

  it('dois atendimentos no mesmo dia são UMA visita — sem intervalo de zero dias', () => {
    const atend = [...com(TERCAS), { dia: '2026-09-01', profissional: 'Bia' }, { dia: '2026-09-08', profissional: 'Bia' }]
    const m = memoriaDoCliente(atend, { variosProfissionais: true })
    expect(m.diaDaSemana).toEqual({ dia: 2, vezes: 5, de: 5 })
    expect(m.faixaDeRetorno).toEqual({ de: 7, ate: 7, intervalos: 4 })
    expect(m.profissional).toEqual({ nome: 'Ana', vezes: 5, de: 5 })
  })

  it('a volta atípica depois das férias não estica a faixa', () => {
    // Intervalos: 20, 21, 22, 23, 24, 90.
    const dias = ['2026-01-01', '2026-01-21', '2026-02-11', '2026-03-05', '2026-03-28', '2026-04-21', '2026-07-20']
    const m = memoriaDoCliente(com(dias), { variosProfissionais: false })
    expect(m.faixaDeRetorno).toEqual({ de: 21, ate: 24, intervalos: 6 })
    expect(frasesDaMemoria(m)).toContain('Costuma voltar entre 21 e 24 dias.')
  })

  it('a ordem de entrada não muda nada', () => {
    const a = memoriaDoCliente(com(TERCAS), { variosProfissionais: true })
    const b = memoriaDoCliente(com([...TERCAS].reverse()), { variosProfissionais: true })
    expect(b).toEqual(a)
  })

  it('sem atendimento: nenhuma frase', () => {
    expect(frasesDaMemoria(memoriaDoCliente([], { variosProfissionais: true }))).toEqual([])
  })
})
