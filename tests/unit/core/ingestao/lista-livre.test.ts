import { describe, expect, it } from 'vitest'

import { gradeDeConversa } from '@/core/ingestao/whatsapp'
import { gradeDeListaLivre, separarLinhaLivre } from '@/core/ingestao/lista-livre'
import { processarArquivo } from '@/lib/ingestao/processar-arquivo'

/** CNV-014b: a lista de quem não tem sistema. Dados inventados. */
const HOJE = '2026-10-13'

const COLADA = ['Minhas clientes:', '', '1. Maria Souza - (11) 99999-0001', '2) João Lima 11 98888 0002 / 11 3333-0002', '• Conceição Ávila — conceicao@exemplo.com', '- Ana Paula', 'Rita Alves: tel 21977770004'].join('\n')

describe('separar a linha livre (CNV-014b)', () => {
  it('marcador, nome, telefones e e-mail em qualquer ordem', () => {
    expect(separarLinhaLivre('1. Maria Souza - (11) 99999-0001')).toEqual({ nome: 'Maria Souza', telefones: ['(11) 99999-0001'], email: null })
    expect(separarLinhaLivre('2) João Lima 11 98888 0002 / 11 3333-0002')).toEqual({ nome: 'João Lima', telefones: ['11 98888 0002', '11 3333-0002'], email: null })
    expect(separarLinhaLivre('• Conceição Ávila — conceicao@exemplo.com')).toEqual({ nome: 'Conceição Ávila', telefones: [], email: 'conceicao@exemplo.com' })
    expect(separarLinhaLivre('Rita Alves: tel 21977770004')).toEqual({ nome: 'Rita Alves', telefones: ['21977770004'], email: null })
  })
})

describe('lista colada vira tabela e passa pela esteira (CNV-014b)', () => {
  it('título fica acima do cabeçalho; cada linha vira uma pessoa', () => {
    const grade = gradeDeListaLivre(COLADA.split('\n').map((l) => [l]))!
    expect(grade.slice(0, 3)).toEqual([['Minhas clientes:'], [''], ['Nome', 'Telefone', 'E-mail']])
  })

  it('ponta a ponta, com dois telefones na mesma linha e nome sem contato', async () => {
    const r = await processarArquivo({ bytes: new TextEncoder().encode(COLADA), nome: 'colado.txt', contexto: { hoje: HOJE } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.resultado.registros.map((x) => [x.nome, x.telefone, x.email])).toEqual([
      ['Maria Souza', '+5511999990001', null],
      ['João Lima', '+5511988880002', null],
      ['Conceição Ávila', null, 'conceicao@exemplo.com'],
      ['Ana Paula', null, null],
      ['Rita Alves', '+5521977770004', null],
    ])
    expect(r.resultado.registros[1]!.telefonesExtras).toEqual(['+551133330002'])
    const c = r.resultado.contagem
    expect(c.ouro + c.comAviso + c.quarentena + c.ignoradas).toBe(c.lidas)
  })

  it('tabela de verdade (cabeçalho de várias colunas) não é tratada como lista, mesmo esparsa', () => {
    const conversa = gradeDeConversa(['15/08/2026 09:15 - Maria Souza: oi', '15/08/2026 09:16 - João Lima: oi', '15/08/2026 09:17 - Ana Paula: oi', '15/08/2026 09:18 - Rita Alves: oi', '15/08/2026 09:19 - Carla Nunes: oi'].join('\n')).grade
    expect(gradeDeListaLivre(conversa)).toBeNull()
    expect(gradeDeListaLivre([['Nome', 'Telefone'], ['Maria'], ['João'], ['Ana']])).toBeNull()
  })
})
