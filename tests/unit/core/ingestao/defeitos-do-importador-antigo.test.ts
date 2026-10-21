import { describe, expect, it } from 'vitest'

import { gradeDeTexto } from '@/core/ingestao/delimitado'
import { processarGrade } from '@/core/ingestao/esteira'

/**
 * docs/103 Onda E: a importação antiga por CSV foi aposentada (DECISOES 2026-10-13) com quatro defeitos
 * conhecidos. Estes casos provam que a esteira, que a substitui, não os tem.
 */
const ler = (csv: string) => processarGrade(gradeDeTexto(csv).grade, { hoje: '2026-10-13' })

describe('defeitos do importador antigo não voltam pela esteira', () => {
  it('D2: célula com dois telefones não descarta a pessoa; o segundo vira telefone extra', () => {
    const r = ler('Nome;Telefone\nAna Lima;(11) 99999-0001 / (11) 98888-0002\nBia Souza;(11) 97777-0003\n')
    const ana = r.registros.find((x) => x.nome === 'Ana Lima')
    expect(ana?.telefone).toBe('+5511999990001')
    expect(ana?.telefonesExtras).toEqual(['+5511988880002'])
  })

  it('D4: linha só de separadores (;;;) é ignorada, não vira erro "nome em branco"', () => {
    const r = ler('Nome;Telefone;E-mail\nAna Lima;(11) 99999-0001;\n;;\nBia Souza;(11) 97777-0003;\n')
    expect(r.registros.map((x) => x.nome)).toEqual(['Ana Lima', 'Bia Souza'])
    expect(r.quarentena).toEqual([])
  })

  it('D12: e-mail inválido não é gravado como se fosse bom', () => {
    const r = ler('Nome;E-mail\nAna Lima;ana@@exemplo\nBia Souza;bia@exemplo.com.br\n')
    expect(r.registros.find((x) => x.nome === 'Ana Lima')?.email).toBeNull()
    expect(r.registros.find((x) => x.nome === 'Bia Souza')?.email).toBe('bia@exemplo.com.br')
  })

  it('D14: coluna de alergia nunca vira etiqueta nem observação da ficha', () => {
    const r = ler('Nome;Etiquetas;Alergias\nAna Lima;vip;dipirona\n')
    const ana = r.registros[0]!
    expect(ana.etiquetas).toEqual(['vip'])
    expect(JSON.stringify(ana)).not.toMatch(/dipirona/i)
  })
})

describe('linha em branco no meio da lista (achado ao provar o D4)', () => {
  it('a lista continua depois da linha em branco: ninguém vira "outra tabela"', () => {
    const r = ler('Nome;Telefone\nAna Lima;(11) 99999-0001\n\n\nBia Souza;(11) 97777-0003\nCris Melo;(11) 96666-0004\n')
    expect(r.registros.map((x) => x.nome)).toEqual(['Ana Lima', 'Bia Souza', 'Cris Melo'])
    expect(r.outrasTabelas).toBe(0)
  })

  it('título e cabeçalho depois da linha em branco abrem OUTRA tabela, como antes', () => {
    const r = ler('Nome;Telefone\nAna Lima;(11) 99999-0001\n\nInativos\nNome;Telefone\nBia Souza;(11) 97777-0003\nCris Melo;(11) 96666-0004\n')
    expect(r.outrasTabelas).toBe(1)
    expect(r.registros.map((x) => x.nome)).not.toContain('Inativos')
  })

  it('rodapé depois da linha em branco continua rodapé, não vira pessoa', () => {
    const r = ler('Nome;Telefone\nAna Lima;(11) 99999-0001\nBia Souza;(11) 97777-0003\n\nGerado pelo Sistema X em 10/10/2026\n')
    expect(r.registros.map((x) => x.nome)).toEqual(['Ana Lima', 'Bia Souza'])
  })
})
