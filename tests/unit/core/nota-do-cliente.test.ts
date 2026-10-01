import { describe, expect, it } from 'vitest'

import {
  PESOS,
  atrasoRelativo,
  classeDaNota,
  notasDoSalao,
  percentil,
  perfilDoCliente,
  variacaoDosIntervalos,
  type HistoricoDoCliente,
} from '@/core/crm/nota-do-cliente'

/** Visitas a cada `intervalo` dias, a mais recente há `ultima` dias. */
function visitas(qtd: number, intervalo: number, ultima: number, valorCents = 5_000) {
  return Array.from({ length: qtd }, (_, i) => ({ diasAtras: ultima + i * intervalo, valorCents }))
}

function cliente(parcial: Partial<HistoricoDoCliente> & { clientId: string }): HistoricoDoCliente {
  return { visitas: [], faltas: 0, cancelamentosTardios: 0, ritmoDias: null, cadastradoHaDias: 365, indicou: 0, ...parcial }
}

describe('perfil do cliente (docs/95 E3)', () => {
  it('uma visita só é Novo, mesmo atrasado', () => {
    expect(perfilDoCliente(cliente({ clientId: 'a', visitas: visitas(1, 0, 200), ritmoDias: 20 }))).toBe('novo')
  })

  it('três vezes o ritmo sem vir é Sumido', () => {
    expect(perfilDoCliente(cliente({ clientId: 'a', visitas: visitas(5, 20, 70), ritmoDias: 20 }))).toBe('sumido')
  })

  it('faltou ou cancelou em cima da hora 30% ou mais (e pelo menos 2 vezes) é "Costuma faltar"', () => {
    expect(perfilDoCliente(cliente({ clientId: 'a', visitas: visitas(4, 20, 5), ritmoDias: 20, faltas: 2 }))).toBe('faltante')
    // Uma falta só não basta, mesmo sendo 1 de 2.
    expect(perfilDoCliente(cliente({ clientId: 'b', visitas: visitas(2, 20, 5), ritmoDias: 20, faltas: 1 }))).not.toBe('faltante')
  })

  it('passou do ritmo (20% ou mais) sem chegar ao triplo é Atrasado', () => {
    expect(perfilDoCliente(cliente({ clientId: 'a', visitas: visitas(5, 20, 30), ritmoDias: 20 }))).toBe('atrasado')
  })

  it('6+ visitas no ano, com intervalo parecido e em dia, é Fiel; o resto é Regular', () => {
    expect(perfilDoCliente(cliente({ clientId: 'a', visitas: visitas(8, 30, 10), ritmoDias: 30 }))).toBe('fiel')
    const irregular = [5, 15, 60, 70, 140, 150, 220].map((d) => ({ diasAtras: d, valorCents: 5_000 }))
    expect(perfilDoCliente(cliente({ clientId: 'b', visitas: irregular, ritmoDias: 40 }))).toBe('regular')
  })
})

describe('peças da conta', () => {
  it('percentil: o maior vale 1, o menor 0, empate fica no meio, salão de um cliente vale 1', () => {
    expect(percentil(10, [1, 5, 10])).toBe(1)
    expect(percentil(1, [1, 5, 10])).toBe(0)
    expect(percentil(5, [5, 5, 5])).toBeCloseTo(0.5)
    expect(percentil(7, [7])).toBe(1)
  })

  it('variação dos intervalos precisa de 3 visitas; intervalo constante dá zero', () => {
    expect(variacaoDosIntervalos(cliente({ clientId: 'a', visitas: visitas(2, 20, 0) }))).toBeNull()
    expect(variacaoDosIntervalos(cliente({ clientId: 'a', visitas: visitas(4, 20, 0) }))).toBe(0)
  })

  it('atraso relativo: sem ritmo ou sem visita é null', () => {
    expect(atrasoRelativo(cliente({ clientId: 'a', visitas: visitas(3, 20, 40), ritmoDias: 20 }))).toBe(2)
    expect(atrasoRelativo(cliente({ clientId: 'a', visitas: visitas(3, 20, 40) }))).toBeNull()
    expect(atrasoRelativo(cliente({ clientId: 'a', ritmoDias: 20 }))).toBeNull()
  })

  it('classe: Ouro a partir de 70, Prata a partir de 40', () => {
    expect(classeDaNota(70)).toBe('ouro')
    expect(classeDaNota(69)).toBe('prata')
    expect(classeDaNota(40)).toBe('prata')
    expect(classeDaNota(39)).toBe('bronze')
  })

  it('os pesos somam 100', () => {
    expect(Object.values(PESOS).reduce((a, b) => a + b, 0)).toBe(100)
  })
})

describe('nota do salão', () => {
  const salao = [
    cliente({ clientId: 'fiel', visitas: visitas(10, 30, 10, 8_000), ritmoDias: 30, cadastradoHaDias: 800, indicou: 2 }),
    cliente({ clientId: 'medio', visitas: visitas(4, 45, 50, 5_000), ritmoDias: 45 }),
    cliente({ clientId: 'faltoso', visitas: visitas(3, 30, 200, 4_000), ritmoDias: 30, faltas: 3 }),
    cliente({ clientId: 'sem-visita', cadastradoHaDias: 3 }),
  ]

  it('a conta fecha: a nota é a soma das partes, e cada parte respeita o máximo', () => {
    for (const n of notasDoSalao(salao)) {
      expect(n.nota).toBe(n.partes.reduce((s, p) => s + p.pontos, 0))
      for (const p of n.partes) {
        expect(p.pontos).toBeGreaterThanOrEqual(0)
        expect(p.pontos).toBeLessThanOrEqual(p.maximo)
        expect(p.motivo.length).toBeGreaterThan(0)
      }
      expect(n.nota).toBeGreaterThanOrEqual(0)
      expect(n.nota).toBeLessThanOrEqual(100)
    }
  })

  it('ordena do jeito que o dono espera: fiel > médio > faltoso sumido > sem visita', () => {
    const porId = Object.fromEntries(notasDoSalao(salao).map((n) => [n.clientId, n]))
    expect(porId.fiel!.nota).toBeGreaterThan(porId.medio!.nota)
    expect(porId.medio!.nota).toBeGreaterThan(porId.faltoso!.nota)
    expect(porId.faltoso!.nota).toBeGreaterThan(porId['sem-visita']!.nota)
    expect(porId.fiel!.classe).toBe('ouro')
    expect(porId.fiel!.perfil).toBe('fiel')
    expect(porId.faltoso!.perfil).toBe('sumido')
  })

  it('quem nunca foi atendido não ganha ponto "neutro" de regularidade nem de recência', () => {
    const [n] = notasDoSalao([cliente({ clientId: 'x', cadastradoHaDias: 3 })])
    const pontos = Object.fromEntries(n!.partes.map((p) => [p.componente, p.pontos]))
    expect(pontos.valor).toBe(0)
    expect(pontos.frequencia).toBe(0)
    expect(pontos.regularidade).toBe(0)
    expect(pontos.recencia).toBe(0)
    expect(n!.classe).toBe('bronze')
  })

  it('mesma entrada, mesma nota (determinística, sem relógio nem sorteio)', () => {
    expect(notasDoSalao(salao)).toEqual(notasDoSalao(salao))
  })

  it('a palavra "ruim" nunca aparece na explicação', () => {
    const textos = notasDoSalao(salao).flatMap((n) => n.partes.map((p) => p.motivo.toLowerCase()))
    expect(textos.length).toBeGreaterThan(0)
    expect(textos.some((t) => t.includes('ruim'))).toBe(false)
  })
})
