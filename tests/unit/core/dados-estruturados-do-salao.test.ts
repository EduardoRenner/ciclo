import { describe, expect, it } from 'vitest'

import { dadosEstruturadosDoSalao, type EntradaSeoDoSalao } from '@/core/seo/dados-estruturados'

/**
 * SEO local é o único SEO que importa para este produto: ninguém procura "barbearia" no mundo,
 * procura "barbearia perto de mim". Sem dados estruturados a página do salão compete só pelo
 * texto; com eles entra nos resultados ricos, com telefone, faixa de preço e estrelas.
 */
const BASE: EntradaSeoDoSalao = {
  nome: 'Barbearia do Zé',
  url: 'https://ciclo.app/barbearia-do-ze',
  vertical: 'barber',
  descricao: 'Corte e barba no centro',
  telefone: '+5551999998888',
  endereco: 'Rua das Flores, 100',
  instagram: 'https://instagram.com/barbeariadoze',
  servicos: [
    { name: 'Corte', priceCents: 4500, pricingModel: 'fixed' },
    { name: 'Barba', priceCents: 3000, pricingModel: 'fixed' },
  ],
  avaliacoes: { average: 4.8, count: 23 },
}

describe('dadosEstruturadosDoSalao', () => {
  it('usa o tipo específico do nicho, não LocalBusiness genérico', () => {
    // Dizer "BeautySalon" para uma barbearia perde a especificidade que o buscador usa para casar
    // com a intenção de quem procura.
    expect(dadosEstruturadosDoSalao(BASE)['@type']).toBe('HairSalon')
    expect(dadosEstruturadosDoSalao({ ...BASE, vertical: 'nails' })['@type']).toBe('NailSalon')
    expect(dadosEstruturadosDoSalao({ ...BASE, vertical: 'tattoo' })['@type']).toBe('TattooParlor')
  })

  it('nicho desconhecido não quebra — cai num tipo válido', () => {
    expect(dadosEstruturadosDoSalao({ ...BASE, vertical: 'coisa_nova' })['@type']).toBe('HealthAndBeautyBusiness')
  })

  it('SALÃO NOVO não recebe aggregateRating', () => {
    // A asserção mais importante do arquivo. `ratingCount: 0` é marcação inválida para o Google e
    // pode desqualificar o resultado rico da página INTEIRA — o oposto do que este código existe
    // para fazer. Salão sem avaliação simplesmente não tem estrelas ainda.
    const novo = dadosEstruturadosDoSalao({ ...BASE, avaliacoes: { average: 0, count: 0 } })
    expect(novo.aggregateRating, 'salão sem avaliação recebeu estrelas vazias').toBeUndefined()
  })

  it('com avaliação de verdade, publica a média e a contagem', () => {
    const d = dadosEstruturadosDoSalao(BASE).aggregateRating as Record<string, unknown>
    expect(d).toMatchObject({ ratingValue: 4.8, reviewCount: 23, bestRating: 5 })
  })

  it('serviço por hora NÃO vira oferta com preço', () => {
    // Anunciar o valor da hora como preço do serviço faria a busca mostrar um número que a cliente
    // não vai pagar — e o preço errado na busca é pior que preço nenhum.
    const d = dadosEstruturadosDoSalao({
      ...BASE,
      servicos: [{ name: 'Consultoria', priceCents: 12000, pricingModel: 'hourly' }],
    })
    expect(d.hasOfferCatalog, 'serviço por hora entrou como oferta de preço fixo').toBeUndefined()
    expect(d.priceRange).toBeUndefined()
  })

  it('faixa de preço sai do menor ao maior serviço fixo', () => {
    expect(dadosEstruturadosDoSalao(BASE).priceRange).toBe('R$ 30 - R$ 45')
  })

  it('campo ausente não vira chave vazia', () => {
    const magro = dadosEstruturadosDoSalao({
      ...BASE, telefone: null, endereco: null, instagram: null, descricao: null, servicos: [],
      avaliacoes: { average: 0, count: 0 },
    })
    for (const chave of ['telephone', 'address', 'sameAs', 'description', 'hasOfferCatalog']) {
      expect(Object.keys(magro), `${chave} apareceu vazio`).not.toContain(chave)
    }
    // Mas o essencial continua: nome, url e tipo sempre saem.
    expect(magro).toMatchObject({ name: 'Barbearia do Zé', url: BASE.url, '@type': 'HairSalon' })
  })
})
