import { describe, expect, it } from 'vitest'

import { dadosEstruturadosDoSalao } from '@/core/seo/dados-estruturados'
import { apelidoDoInstagram, urlDoInstagram } from '@/core/text/instagram'

/**
 * O campo "Instagram" é texto livre, e o formulário só tirava o `@` inicial. Medido em
 * 2026-08-31: três dos cinco jeitos naturais de preencher produziam link quebrado na página
 * pública, porque ela concatenava `https://instagram.com/${valor}` direto.
 *
 * Os casos abaixo são os que a pessoa realmente digita — colar o endereço do próprio perfil é o
 * gesto mais provável de quem tem o Instagram aberto na outra aba.
 */
describe('apelidoDoInstagram', () => {
  const CASOS: ReadonlyArray<[string, string]> = [
    ['barbeariadomrocha', 'barbeariadomrocha'],
    ['@barbeariadomrocha', 'barbeariadomrocha'],
    ['  @barbeariadomrocha  ', 'barbeariadomrocha'],
    ['https://instagram.com/barbeariadomrocha', 'barbeariadomrocha'],
    ['http://instagram.com/barbeariadomrocha', 'barbeariadomrocha'],
    ['instagram.com/barbeariadomrocha', 'barbeariadomrocha'],
    ['www.instagram.com/barbeariadomrocha/', 'barbeariadomrocha'],
    ['https://www.instagram.com/barbeariadomrocha/', 'barbeariadomrocha'],
    // O app do celular põe `?igsh=...` ao compartilhar o perfil.
    ['https://www.instagram.com/barbeariadomrocha?igsh=abc123', 'barbeariadomrocha'],
    ['salao.da.ana_', 'salao.da.ana_'],
  ]

  it.each(CASOS)('%s vira %s', (bruto, esperado) => {
    expect(apelidoDoInstagram(bruto)).toBe(esperado)
  })

  it('devolve null quando não sobra apelido reconhecível', () => {
    for (const lixo of ['', '   ', '@', 'https://instagram.com/', 'nome com espaço', 'a'.repeat(31)]) {
      expect(apelidoDoInstagram(lixo), lixo).toBeNull()
    }
    expect(apelidoDoInstagram(null)).toBeNull()
    expect(apelidoDoInstagram(undefined)).toBeNull()
  })
})

describe('urlDoInstagram', () => {
  /**
   * O que a guarda protege de verdade: o endereço montado NUNCA pode ter o domínio duas vezes.
   * Casa com o defeito (`instagram.com` repetido), não com o nome da função — um teste que só
   * conferisse "começa com https://instagram.com/" passaria com o defeito de volta.
   */
  it('nunca repete o domínio, venha o valor como vier', () => {
    for (const bruto of [
      'barbeariadomrocha',
      'https://instagram.com/barbeariadomrocha',
      'www.instagram.com/barbeariadomrocha/',
      'instagram.com/barbeariadomrocha',
    ]) {
      const url = urlDoInstagram(bruto)!
      expect(url, bruto).toBe('https://instagram.com/barbeariadomrocha')
      expect(url.match(/instagram\.com/g), bruto).toHaveLength(1)
    }
  })

  it('null vira null, para a tela não desenhar link para lugar nenhum', () => {
    expect(urlDoInstagram('nome com espaço')).toBeNull()
    expect(urlDoInstagram(null)).toBeNull()
  })
})

describe('sameAs do JSON-LD', () => {
  function seoCom(instagram: string | null) {
    return dadosEstruturadosDoSalao({
      nome: 'Salão', url: 'https://ex.com/salao', vertical: 'barber', descricao: null,
      telefone: null, endereco: null, instagram, servicos: [], avaliacoes: { average: 0, count: 0 },
    }) as { sameAs?: string[] }
  }

  /**
   * `sameAs` é URL pelo schema.org. Guardava o apelido cru, que é marcação inválida — a mesma
   * régua que o `aggregateRating` já aplica de propósito naquele arquivo.
   */
  it('é sempre uma URL absoluta, nunca o apelido cru', () => {
    const sameAs = seoCom('barbeariadomrocha')!.sameAs!
    expect(sameAs).toEqual(['https://instagram.com/barbeariadomrocha'])
    for (const valor of sameAs) {
      expect(() => new URL(valor)).not.toThrow()
      expect(valor.startsWith('https://')).toBe(true)
    }
  })

  it('some quando o valor não vira apelido, em vez de publicar marcação inválida', () => {
    expect(seoCom('nome com espaço').sameAs).toBeUndefined()
    expect(seoCom(null).sameAs).toBeUndefined()
  })
})
