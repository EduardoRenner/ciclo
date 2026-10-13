import { describe, expect, it } from 'vitest'

import { detectarSeparador, gradeDeTexto, lerDelimitado } from '@/core/ingestao/delimitado'
import { acharTabelas, tipoDaCelula, type TabelasAchadas } from '@/core/ingestao/tabela'

/** CNV-003: E1 (texto delimitado) e E3 (achar a tabela). Dados inventados. */

/** A invariante da esteira começa aqui: toda linha da grade sai numa tabela ou em `ignoradas`. */
function contaFecha(r: TabelasAchadas) {
  const nasTabelas = r.tabelas.reduce((s, t) => s + t.linhas.length, 0)
  expect(nasTabelas + r.ignoradas.length, 'linhas da grade = dados + ignoradas').toBe(r.totalDeLinhas)
  const origens = [...r.tabelas.flatMap((t) => t.linhas.map((l) => l.origem)), ...r.ignoradas.map((i) => i.origem)].sort((a, b) => a - b)
  expect(new Set(origens).size, 'nenhuma linha contada duas vezes').toBe(origens.length)
}

describe('texto delimitado (CNV-003)', () => {
  it('aspas com separador, quebra de linha e aspas escapadas dentro do campo', () => {
    expect(lerDelimitado('nome;obs\r\n"Silva; Maria";"disse ""oi""\nna fila"\n', ';')).toEqual([
      ['nome', 'obs'],
      ['Silva; Maria', 'disse "oi"\nna fila'],
    ])
  })

  it('o separador é o que se repete com constância, não o primeiro que aparece', () => {
    expect(detectarSeparador('nome;telefone;valor\nSilva, Maria;11 99999-0000;80,00\nJoão;11 98888-0000;45,50')).toBe(';')
    expect(detectarSeparador('nome,telefone\nMaria,11999990000\nJoão,11988880000')).toBe(',')
    expect(detectarSeparador('nome\ttelefone\nMaria\t11999990000')).toBe('\t')
    expect(detectarSeparador('nome|telefone\nMaria|11999990000')).toBe('|')
  })

  it('lista colada sem separador vira uma célula por linha', () => {
    const r = gradeDeTexto('Maria 11 99999-0000\nJoão (21) 98888-7777\n')
    expect(r.separador).toBeNull()
    expect(r.grade[0]).toEqual(['Maria 11 99999-0000'])
  })
})

describe('tipo da célula', () => {
  it('telefone, data, dinheiro, e-mail, número e texto', () => {
    expect(tipoDaCelula('(11) 99999-0000')).toBe('telefone')
    expect(tipoDaCelula('+5511999990000')).toBe('telefone')
    expect(tipoDaCelula('15/08/2026')).toBe('data')
    expect(tipoDaCelula('2026-08-15 14:30')).toBe('data')
    expect(tipoDaCelula('R$ 80,00')).toBe('dinheiro')
    expect(tipoDaCelula('1.234,56')).toBe('dinheiro')
    expect(tipoDaCelula('ana@exemplo.com')).toBe('email')
    expect(tipoDaCelula('42')).toBe('numero')
    expect(tipoDaCelula('Corte masculino')).toBe('texto')
  })
})

describe('achar a tabela (CNV-003, defeito D3 da auditoria)', () => {
  it('export com título, filtros, linha em branco, cabeçalho na linha 4, total e rodapé', () => {
    const { grade } = gradeDeTexto(
      [
        'Relatório de Clientes',
        'Período: 01/01/2026 a 30/09/2026',
        ';;;',
        'Nome;Telefone;Última visita;Valor',
        'Maria Souza;(11) 99999-0001;15/08/2026;R$ 80,00',
        'João Lima;(11) 99999-0002;02/09/2026;R$ 45,00',
        'Ana Paula;(11) 99999-0003;20/09/2026;R$ 120,00',
        'Total;;;R$ 245,00',
        'Gerado pelo Sistema X em 30/09/2026',
      ].join('\n'),
    )
    const r = acharTabelas(grade)
    expect(r.tabelas).toHaveLength(1)
    const t = r.tabelas[0]!
    expect(t.temCabecalho).toBe(true)
    expect(t.cabecalho).toEqual(['Nome', 'Telefone', 'Última visita', 'Valor'])
    expect(t.linhas.map((l) => l.celulas[0])).toEqual(['Maria Souza', 'João Lima', 'Ana Paula'])
    expect(r.ignoradas.map((i) => i.motivo)).toEqual(['titulo', 'filtro', 'vazia', 'cabecalho', 'total', 'rodape'])
    contaFecha(r)
  })

  it('relatório agrupado por profissional: o nome solto vira a coluna "Grupo"', () => {
    const { grade } = gradeDeTexto(
      [
        'Cliente;Telefone;Data',
        'Profissional: Ana',
        'Maria;11999990001;15/08/2026',
        'João;11999990002;16/08/2026',
        'Profissional: Bia',
        'Carla;11999990003;17/08/2026',
      ].join('\n'),
    )
    const r = acharTabelas(grade)
    const t = r.tabelas[0]!
    expect(t.cabecalho).toEqual(['Cliente', 'Telefone', 'Data', 'Grupo'])
    expect(t.linhas.map((l) => [l.celulas[0], l.celulas[3]])).toEqual([
      ['Maria', 'Ana'],
      ['João', 'Ana'],
      ['Carla', 'Bia'],
    ])
    expect(r.ignoradas.filter((i) => i.motivo === 'grupo')).toHaveLength(2)
    contaFecha(r)
  })

  it('grupo sem rótulo (só o nome numa linha) também vira coluna', () => {
    // Relatório de verdade: dois grupos, cada um com mais de uma linha (uma lista com um nome solto não é grupo).
    const { grade } = gradeDeTexto(['Cliente;Telefone', 'Ana', 'Maria;11999990001', 'Rita;11999990002', 'Bia', 'Carla;11999990003', 'Duda;11999990004'].join('\n'))
    const r = acharTabelas(grade)
    expect(r.tabelas[0]!.linhas.map((l) => l.celulas[2])).toEqual(['Ana', 'Ana', 'Bia', 'Bia'])
    contaFecha(r)
  })

  it('cabeçalho repetido a cada página sai como ignorada, não como cliente "Nome"', () => {
    const { grade } = gradeDeTexto(['Nome;Telefone', 'Maria;11999990001', 'Nome;Telefone', 'João;11999990002'].join('\n'))
    const r = acharTabelas(grade)
    expect(r.tabelas[0]!.linhas.map((l) => l.celulas[0])).toEqual(['Maria', 'João'])
    expect(r.ignoradas.map((i) => i.motivo)).toEqual(['cabecalho', 'cabecalho_repetido'])
    contaFecha(r)
  })

  it('duas tabelas na mesma aba, separadas por linha em branco, cada uma com seu cabeçalho', () => {
    const { grade } = gradeDeTexto(['Nome;Telefone', 'Maria;11999990001', 'João;11999990002', '', 'Serviço;Preço', 'Corte;R$ 45,00', 'Barba;R$ 35,00'].join('\n'))
    const r = acharTabelas(grade)
    expect(r.tabelas.map((t) => t.cabecalho[0])).toEqual(['Nome', 'Serviço'])
    expect(r.tabelas.map((t) => t.linhas.length)).toEqual([2, 2])
    contaFecha(r)
  })

  it('lista esparsa (nome sem telefone): linha de uma célula é dado, não rodapé nem nome de grupo', () => {
    const { grade } = gradeDeTexto(['Nome;Telefone', 'Maria Souza;', 'João Lima;11999990002', 'Ana Paula;', ';11988880003', 'Gerado pelo Sistema X'].join('\n'))
    const r = acharTabelas(grade)
    expect(r.tabelas[0]!.linhas.map((l) => l.celulas[0])).toEqual(['Maria Souza', 'João Lima', 'Ana Paula', ''])
    expect(r.tabelas[0]!.colunaDeGrupo).toBeNull()
    expect(r.ignoradas.map((i) => i.motivo)).toEqual(['cabecalho', 'rodape'])
    contaFecha(r)
  })

  it('dados sem cabeçalho: nomes genéricos e confiança menor, sem perder a primeira linha', () => {
    const { grade } = gradeDeTexto(['Maria;11999990001;15/08/2026', 'João;11999990002;16/08/2026'].join('\n'))
    const r = acharTabelas(grade)
    const t = r.tabelas[0]!
    expect(t.temCabecalho).toBe(false)
    expect(t.cabecalho).toEqual(['Coluna 1', 'Coluna 2', 'Coluna 3'])
    expect(t.linhas).toHaveLength(2)
    expect(t.confianca).toBeLessThan(0.6)
    contaFecha(r)
  })
})
