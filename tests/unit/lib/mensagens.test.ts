import { describe, expect, it } from 'vitest'

import { aplicarVariaveis, linkWhatsApp, precisaDeAgendamento, saidaDeContato } from '@/lib/mensagens'

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

/**
 * A saída de contato das telas de sucesso — e o motivo de ela ser função e não ternário no JSX.
 *
 * Medido em 05/09/2026: os seis tenants em produção têm WhatsApp preenchido, então **dois dos três
 * estados nunca renderizam** com os dados reais. É a armadilha das estrelas do `docs/42` §2, onde
 * a primeira versão do conserto quebrou exatamente o estado que os dados não produziam, com
 * typecheck, lint e 1.624 testes verdes. Aqui os três estados são exercitados de graça.
 */
describe('saidaDeContato', () => {
  const TEXTO = 'Oi! Acabei de marcar um horário.'

  it('WhatsApp ganha do telefone — a pessoa acabou de dizer que fala por lá', () => {
    const saida = saidaDeContato('+5511987654321', '+5511333334444', 'Dom Rocha', TEXTO)
    expect(saida?.canal).toBe('whatsapp')
    expect(saida?.href).toContain('wa.me/5511987654321')
    expect(saida?.href).toContain(encodeURIComponent(TEXTO))
    expect(saida?.rotulo).toBe('Falar no WhatsApp')
  })

  it('sem WhatsApp, o telefone assume — e o rótulo diz para quem se liga', () => {
    const saida = saidaDeContato(null, '+5511333334444', 'Dom Rocha', TEXTO)
    expect(saida).toEqual({ canal: 'telefone', href: 'tel:+5511333334444', rotulo: 'Ligar para Dom Rocha' })
  })

  /*
   * O caso que a cópia local de `linkWhatsapp` não tinha: ela montaria `wa.me/11`, que abre
   * "número inválido" no celular de quem queria falar com o salão. Cair no telefone é melhor
   * que oferecer um link quebrado.
   */
  it('número curto demais não vira link quebrado — cai no telefone', () => {
    const saida = saidaDeContato('11', '+5511333334444', 'Dom Rocha', TEXTO)
    expect(saida?.canal).toBe('telefone')
  })

  it('sem nenhum dos dois, não inventa botão', () => {
    expect(saidaDeContato(null, null, 'Dom Rocha', TEXTO)).toBeNull()
    expect(saidaDeContato('11', null, 'Dom Rocha', TEXTO)).toBeNull()
  })
})
