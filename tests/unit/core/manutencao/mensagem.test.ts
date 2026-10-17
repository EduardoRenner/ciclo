import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { mensagemDeLembrete, motivoDoItem } from '@/core/manutencao/mensagem'
import type { VencimentoDoItem } from '@/core/manutencao/vencimento'

const d = (s: string) => Temporal.PlainDate.from(s)
const hoje = d('2026-10-14')

function v(parcial: Partial<VencimentoDoItem> & Pick<VencimentoDoItem, 'item' | 'estado'>): VencimentoDoItem {
  return {
    venceEm: null,
    relogio: null,
    porUso: null,
    porTempo: null,
    porDesgaste: null,
    ritmo: { porDia: 40, origem: 'medido', leituras: 3 },
    kmDeVencimento: null,
    ...parcial,
  }
}

describe('a mensagem que diz o relógio (A-12, C-007)', () => {
  it('km medido: diz quantos km faltam, arredondado', () => {
    expect(motivoDoItem(v({ item: 'oleo_motor', estado: 'nesta_visita', relogio: 'uso', kmDeVencimento: 40_000 }), 39_480, hoje)).toBe(
      'óleo do motor e filtro de óleo: pela quilometragem, faltam ~500 km',
    )
  })

  it('ritmo de referência: NÃO inventa número — diz "pela média de uso"', () => {
    const t = motivoDoItem(v({ item: 'oleo_motor', estado: 'nesta_visita', relogio: 'uso', kmDeVencimento: 40_000, ritmo: { porDia: 36, origem: 'referencia', leituras: 1 } }), 39_480, hoje)
    expect(t).toContain('pela média de uso')
    expect(t).not.toMatch(/\d/)
  })

  it('tempo: quantos meses desde a última troca', () => {
    expect(motivoDoItem(v({ item: 'fluido_freio', estado: 'vencido', relogio: 'tempo' }), null, hoje, d('2024-07-10'))).toBe('fluido de freio: 27 meses desde a última troca')
  })

  it('sem histórico: "vale conferir", nunca "venceu"', () => {
    const t = motivoDoItem(v({ item: 'velas', estado: 'perguntar' }), null, hoje)
    expect(t).toContain('vale conferir')
    expect(t).not.toMatch(/venc/i)
  })

  it('mensagem: crítico vencido primeiro, no máximo 3 motivos, o resto contado, e o horário sugerido', () => {
    const texto = mensagemDeLembrete(
      {
        nomeDoCliente: 'Ana',
        veiculo: 'o Onix',
        nomeDoNegocio: 'Oficina do Bairro',
        kmAtual: 39_480,
        hoje,
        horarioSugerido: 'sexta, às 8h',
        itens: [
          v({ item: 'alinhamento', estado: 'nesta_visita', relogio: 'uso', kmDeVencimento: 40_000 }),
          v({ item: 'oleo_motor', estado: 'nesta_visita', relogio: 'uso', kmDeVencimento: 40_000 }),
          v({ item: 'fluido_freio', estado: 'vencido', relogio: 'tempo' }),
          v({ item: 'velas', estado: 'perguntar' }),
          v({ item: 'bateria', estado: 'em_dia', relogio: 'tempo' }),
        ],
      },
      { fluido_freio: d('2024-07-10') },
    )
    const linhas = texto.split('\n')
    expect(linhas[0]).toBe('Oi, Ana! Aqui é da Oficina do Bairro. Pelo plano de manutenção, o Onix tem itens para olhar:')
    expect(linhas[1]).toContain('fluido de freio')
    expect(texto).toContain('e mais 1 item no orçamento')
    expect(texto).not.toContain('bateria')
    expect(texto.endsWith('Quer marcar? Temos sexta, às 8h livre.')).toBe(true)
  })

  it('nada a lembrar: mensagem vazia (quem chama não manda nada)', () => {
    expect(mensagemDeLembrete({ nomeDoCliente: 'Ana', veiculo: 'o Onix', nomeDoNegocio: 'X', kmAtual: 1, hoje, itens: [v({ item: 'bateria', estado: 'em_dia' })] })).toBe('')
  })

  it('a mensagem não promete envio nem canal e não usa palavra que soa como pressão de venda', () => {
    const texto = mensagemDeLembrete({ nomeDoCliente: 'Ana', veiculo: 'o Onix', nomeDoNegocio: 'X', kmAtual: 39_480, hoje, itens: [v({ item: 'oleo_motor', estado: 'vencido', relogio: 'uso', kmDeVencimento: 39_000 })] })
    expect(texto).not.toMatch(/vamos (te )?(avisar|mandar|enviar)|automaticamente|urgente|última chance|promoção/i)
  })
})
