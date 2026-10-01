import { describe, expect, it } from 'vitest'

import {
  PESOS,
  atrasoRelativo,
  classeDaNota,
  lerPartes,
  montarHistoricos,
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

describe('montarHistoricos: o que conta como visita, falta e cancelamento em cima da hora', () => {
  const AGORA = Date.parse('2026-10-01T12:00:00Z')
  const DIA = 86_400_000
  const iso = (ms: number) => new Date(ms).toISOString()

  const [h] = montarHistoricos(
    [
      { id: 'c1', createdAt: iso(AGORA - 400 * DIA), referredBy: null },
      { id: 'c2', createdAt: iso(AGORA - 10 * DIA), referredBy: 'c1' },
    ],
    [
      { clientId: 'c1', status: 'done', startsAt: iso(AGORA - 10 * DIA), priceCents: 5_000, canceledAt: null },
      { clientId: 'c1', status: 'done', startsAt: iso(AGORA + 2 * DIA), priceCents: 5_000, canceledAt: null },
      { clientId: 'c1', status: 'no_show', startsAt: iso(AGORA - 30 * DIA), priceCents: 5_000, canceledAt: null },
      { clientId: 'c1', status: 'canceled', startsAt: iso(AGORA - 50 * DIA), priceCents: 5_000, canceledAt: iso(AGORA - 50 * DIA - 3 * 3_600_000) },
      { clientId: 'c1', status: 'canceled', startsAt: iso(AGORA - 60 * DIA), priceCents: 5_000, canceledAt: iso(AGORA - 62 * DIA) },
      { clientId: 'outro-salao', status: 'done', startsAt: iso(AGORA - 5 * DIA), priceCents: 9_000, canceledAt: null },
    ],
    [
      { clientId: 'c1', ritmoDias: 40 },
      { clientId: 'c1', ritmoDias: 20 },
    ],
    AGORA,
  )

  it('visita é só atendimento concluído no passado', () => {
    expect(h!.visitas).toEqual([{ diasAtras: 10, valorCents: 5_000 }])
  })

  it('falta é no_show; cancelamento só conta se foi a menos de 24h do horário', () => {
    expect(h!.faltas).toBe(1)
    expect(h!.cancelamentosTardios).toBe(1)
  })

  it('ritmo é o mais curto entre os serviços; indicação conta para quem indicou; antiguidade em dias', () => {
    expect(h!.ritmoDias).toBe(20)
    expect(h!.indicou).toBe(1)
    expect(h!.cadastradoHaDias).toBe(400)
  })
})

describe('lerPartes: o que vem do banco', () => {
  it('aceita o que a conta grava e descarta o resto sem lançar', () => {
    const [n] = notasDoSalao([cliente({ clientId: 'x', visitas: visitas(3, 20, 5), ritmoDias: 20 })])
    expect(lerPartes(JSON.parse(JSON.stringify(n!.partes)))).toEqual(n!.partes)
    expect(lerPartes(null)).toEqual([])
    expect(lerPartes('texto')).toEqual([])
    expect(lerPartes([{ componente: 'inventado', pontos: 1, maximo: 2, motivo: 'x' }, { componente: 'valor', pontos: '3' }])).toEqual([])
  })
})
