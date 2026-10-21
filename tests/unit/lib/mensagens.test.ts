import { describe, expect, it } from 'vitest'

import { CORPOS_PADRAO_DE_VOLTA, aplicarVariaveis, linkWhatsApp, precisaDeAgendamento, saidaDeContato, textoDeVolta, textoDoRetorno } from '@/lib/mensagens'
import { MODELOS_PADRAO } from '@/server/services/mensagens-prontas'

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

describe('textoDeVolta (docs/82 §7)', () => {
  it('primeiro nome, serviço em minúscula, na voz de quem manda', () => {
    expect(textoDeVolta({ nome: 'Joana Teste', servico: 'Corte' })).toBe(
      'Oi, Joana! Faz um tempinho desde seu último horário de corte. Quer marcar essa semana?',
    )
  })

  it('nome em branco não vira "Oi, !"; serviço feminino não vira "seu último barba"', () => {
    expect(textoDeVolta({ nome: '  ', servico: 'Barba' })).toBe('Oi! Faz um tempinho desde seu último horário de barba. Quer marcar essa semana?')
  })

  it('com o link de volta, o link vai no fim, depois da pergunta (docs/95 E1)', () => {
    expect(textoDeVolta({ nome: 'Joana', servico: 'Corte', link: 'https://seuciclo.com.br/x/agendar?volta=t' })).toBe(
      'Oi, Joana! Faz um tempinho desde seu último horário de corte. Quer marcar essa semana? É só escolher o horário aqui: https://seuciclo.com.br/x/agendar?volta=t',
    )
    // Link ausente (sem chave de assinatura) não deixa frase pela metade.
    expect(textoDeVolta({ nome: 'Joana', servico: 'Corte', link: null })).toBe(
      'Oi, Joana! Faz um tempinho desde seu último horário de corte. Quer marcar essa semana?',
    )
  })
})

describe('textoDeVolta com o sujeito (C-025, AUT-101)', () => {
  it('o animal entra com a grafia original e sem artigo; sem sujeito, o texto não muda', () => {
    expect(textoDeVolta({ nome: 'Ana Souza', servico: 'Banho', sujeito: 'Mel' })).toBe(
      'Oi, Ana! Faz um tempinho desde seu último horário de banho para Mel. Quer marcar essa semana?',
    )
    expect(textoDeVolta({ nome: 'Ana Souza', servico: 'Banho', sujeito: null })).toBe(textoDeVolta({ nome: 'Ana Souza', servico: 'Banho' }))
    expect(textoDeVolta({ nome: 'Ana', servico: 'Banho', sujeito: 'Mel' })).not.toMatch(/\bd[ao] Mel\b/)
  })
})


describe('textoDoRetorno: o Recuperar usa a mensagem que o negócio escreveu (RET-01)', () => {
  const pessoa = { nome: 'Fernanda Lima', servico: 'Manutenção de cílios', link: 'https://x.test/v/abc' }

  it('modelo editado: usa o corpo, com nome e serviço trocados', () => {
    const modelo = { body: 'Oi {{nome}}! Vi que faz tempo da sua {{servico}}. Quer voltar? {{link}}', active: true }
    expect(textoDoRetorno({ modelo, ...pessoa })).toBe('Oi Fernanda! Vi que faz tempo da sua Manutenção de cílios. Quer voltar? https://x.test/v/abc')
  })

  it('modelo igual ao padrão (o de hoje ou o de antes de 19/08): o texto de volta de sempre', () => {
    expect(CORPOS_PADRAO_DE_VOLTA.length).toBeGreaterThanOrEqual(2)
    for (const body of CORPOS_PADRAO_DE_VOLTA) {
      expect(textoDoRetorno({ modelo: { body, active: true }, ...pessoa })).toBe(textoDeVolta(pessoa))
    }
    // Espaço sobrando nas pontas não conta como edição.
    expect(textoDoRetorno({ modelo: { body: ` ${CORPOS_PADRAO_DE_VOLTA[0]}\n`, active: true }, ...pessoa })).toBe(textoDeVolta(pessoa))
  })

  it('modelo desligado ou ausente: o texto de volta de sempre', () => {
    expect(textoDoRetorno({ modelo: { body: 'Oi {{nome}}, saudade!', active: false }, ...pessoa })).toBe(textoDeVolta(pessoa))
    expect(textoDoRetorno({ modelo: null, ...pessoa })).toBe(textoDeVolta(pessoa))
  })

  it('modelo editado sem {{link}}: nada é acrescentado', () => {
    expect(textoDoRetorno({ modelo: { body: 'Oi {{nome}}, saudade! Me chama.', active: true }, ...pessoa })).toBe('Oi Fernanda, saudade! Me chama.')
  })

  it('o padrão semeado no negócio novo é o mesmo que o Retorno reconhece como padrão', () => {
    const semeado = MODELOS_PADRAO.find((m) => m.slug === 'sentimos_falta')?.body
    expect(semeado).toBeTruthy()
    expect(CORPOS_PADRAO_DE_VOLTA).toContain(semeado)
  })
})
