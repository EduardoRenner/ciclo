import { describe, expect, it } from 'vitest'

import { lerListaDeNomes, MAX_DA_LISTA, pessoasDosContatos } from '@/core/ciclo/lista-de-nomes'

describe('lerListaDeNomes — a lista que o dono já tem no bloco de notas ou no WhatsApp', () => {
  it('um nome por linha, ignorando linha vazia e CRLF', () => {
    expect(lerListaDeNomes('Dona Alzira\r\n\r\n  Marcos  \nRafael\n')).toEqual([
      { nome: 'Dona Alzira', telefone: '' },
      { nome: 'Marcos', telefone: '' },
      { nome: 'Rafael', telefone: '' },
    ])
  })

  it('tira numeração e marcador de lista', () => {
    expect(lerListaDeNomes('1. Marcos\n2) Rafael\n- Diego\n• Paulo\n* Jorge\n10 - Lucas').map((p) => p.nome)).toEqual([
      'Marcos',
      'Rafael',
      'Diego',
      'Paulo',
      'Jorge',
      'Lucas',
    ])
  })

  it('separa o telefone do nome, em qualquer formato comum', () => {
    expect(lerListaDeNomes('Marcos - (49) 99999-0001\nRafael: +55 49 98888 0002\nDiego 49999990003\nPaulo, 49 9 7777-0004')).toEqual([
      { nome: 'Marcos', telefone: '49999990001' },
      { nome: 'Rafael', telefone: '+5549988880002' },
      { nome: 'Diego', telefone: '49999990003' },
      { nome: 'Paulo', telefone: '49977770004' },
    ])
  })

  it('telefone no começo da linha com DDD e hífen não vira marcador de lista (revisão 2026-09-23)', () => {
    expect(lerListaDeNomes('49-99999-0001 Marcos\n1-Rafael\n2.Dona Alzira')).toEqual([
      { nome: 'Marcos', telefone: '49999990001' },
      { nome: 'Rafael', telefone: '' },
      { nome: 'Dona Alzira', telefone: '' },
    ])
  })

  it('número curto não é telefone: "Corte 2" continua sendo nome', () => {
    expect(lerListaDeNomes('João 2\nAna da rua 15')).toEqual([
      { nome: 'João 2', telefone: '' },
      { nome: 'Ana da rua 15', telefone: '' },
    ])
  })

  it('linha só com telefone, sem nome, fica de fora — nome é obrigatório', () => {
    expect(lerListaDeNomes('(49) 99999-0001\nMarcos')).toEqual([{ nome: 'Marcos', telefone: '' }])
  })

  it('o mesmo nome duas vezes vira uma pessoa só (maiúscula e espaço não contam)', () => {
    expect(lerListaDeNomes('Marcos\nmarcos \nMARCOS  - 49999990001').map((p) => p.nome)).toEqual(['Marcos'])
  })

  it('respeita os tetos da rota: 200 pessoas, 120 letras de nome', () => {
    const muitos = Array.from({ length: MAX_DA_LISTA + 30 }, (_, i) => `Pessoa ${String.fromCharCode(65 + (i % 26))}${i}`).join('\n')
    expect(lerListaDeNomes(muitos)).toHaveLength(MAX_DA_LISTA)
    expect(lerListaDeNomes('A'.repeat(300))[0]!.nome).toHaveLength(120)
  })
})

describe('pessoasDosContatos — o seletor de contatos do Android', () => {
  it('primeiro nome e primeiro telefone de cada contato, só dígitos', () => {
    expect(
      pessoasDosContatos([
        { name: ['Marcos Barba'], tel: ['+55 49 99999-0001', '49 3333-0000'] },
        { name: ['Rafael'], tel: [] },
      ]),
    ).toEqual([
      { nome: 'Marcos Barba', telefone: '+5549999990001' },
      { nome: 'Rafael', telefone: '' },
    ])
  })

  it('contato sem nome fica de fora; repetido vira um só', () => {
    expect(pessoasDosContatos([{ name: [], tel: ['49999990001'] }, { name: ['Ana'] }, { name: ['ana'] }])).toEqual([{ nome: 'Ana', telefone: '' }])
  })
})
