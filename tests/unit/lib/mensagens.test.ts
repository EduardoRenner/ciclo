import { describe, expect, it } from 'vitest'

import { aplicarVariaveis, linkWhatsApp, precisaDeAgendamento } from '@/lib/mensagens'

describe('aplicarVariaveis', () => {
  it('troca as variáveis pelo valor', () => {
    const texto = aplicarVariaveis('Oi {{nome}}, seu {{servico}} é {{data}} às {{hora}}.', {
      nome: 'Bruno',
      servico: 'Corte',
      data: '12/09',
      hora: '15:30',
    })
    expect(texto).toBe('Oi Bruno, seu Corte é 12/09 às 15:30.')
  })

  it('usa só o primeiro nome — "Fala, Bruno" soa como gente, "Fala, Bruno Almeida" soa como cobrança', () => {
    expect(aplicarVariaveis('Fala, {{nome}}!', { nome: 'Bruno Almeida Souza' })).toBe('Fala, Bruno!')
  })

  it('variável sem valor vira vazio, nunca a chave crua na cara do cliente', () => {
    expect(aplicarVariaveis('Oi {{nome}}, tudo bem?', { nome: null })).toBe('Oi , tudo bem?')
    expect(aplicarVariaveis('Oi {{nome}}!', {})).toBe('Oi !')
  })

  it('aceita espaço dentro das chaves e ignora variável que não existe', () => {
    expect(aplicarVariaveis('{{ nome }} e {{inventada}}', { nome: 'Ana' })).toBe('Ana e ')
  })

  it('texto sem variável nenhuma passa intacto', () => {
    expect(aplicarVariaveis('Bom dia!', { nome: 'Ana' })).toBe('Bom dia!')
  })
})

describe('precisaDeAgendamento', () => {
  it('acusa modelo que depende de horário marcado', () => {
    expect(precisaDeAgendamento('Seu horário é {{data}} às {{hora}}')).toBe(true)
    expect(precisaDeAgendamento('Confirmando seu {{servico}}')).toBe(true)
  })

  it('modelo que só usa nome e negócio serve para disparo em lote', () => {
    expect(precisaDeAgendamento('Oi {{nome}}, saudades aqui na {{negocio}}!')).toBe(false)
  })
})

describe('linkWhatsApp', () => {
  it('monta o link com o número só de dígitos e o texto escapado', () => {
    const link = linkWhatsApp('+5511991110001', 'Oi Bruno, tudo bem?')
    expect(link).toBe('https://wa.me/5511991110001?text=Oi%20Bruno%2C%20tudo%20bem%3F')
  })

  it('sem telefone não há link — a tela precisa saber disso para não oferecer o botão', () => {
    expect(linkWhatsApp(null, 'oi')).toBeNull()
  })

  it('número curto demais é recusado em vez de virar link quebrado', () => {
    expect(linkWhatsApp('+55119', 'oi')).toBeNull()
  })

  it('emoji e quebra de linha sobrevivem à codificação', () => {
    const link = linkWhatsApp('+5511991110001', 'Bora?\n💈')
    expect(link).toContain('%0A')
    expect(decodeURIComponent(link!)).toContain('💈')
  })
})
