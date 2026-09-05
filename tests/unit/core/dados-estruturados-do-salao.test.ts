import { describe, expect, it } from 'vitest'

import { dadosEstruturadosDoSalao, type EntradaSeoDoSalao } from '@/core/seo/dados-estruturados'

/**
 * SEO local é o único SEO que importa para este produto: ninguém procura "barbearia" no mundo,
 * procura "barbearia perto de mim". Sem dados estruturados a página do salão compete só pelo
 * texto; com eles entra nos resultados ricos, com telefone, faixa de preço e estrelas.
 */
const BASE: EntradaSeoDoSalao = {
  nome: 'Barbearia do Zé',
  url: 'https://seuciclo.com.br/barbearia-do-ze',
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
  imagem: 'https://cdn.exemplo.com/vitrine/capa.webp',
  horarios: [
    { weekday: 1, opensAt: '09:00:00', closesAt: '18:00:00' },
    { weekday: 6, opensAt: '09:00:00', closesAt: '13:00:00' },
  ],
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
      avaliacoes: { average: 0, count: 0 }, imagem: null, horarios: [],
    })
    for (const chave of ['telephone', 'address', 'sameAs', 'description', 'hasOfferCatalog', 'image', 'openingHoursSpecification']) {
      expect(Object.keys(magro), `${chave} apareceu vazio`).not.toContain(chave)
    }
    // Mas o essencial continua: nome, url e tipo sempre saem.
    expect(magro).toMatchObject({ name: 'Barbearia do Zé', url: BASE.url, '@type': 'HairSalon' })
  })
})

describe('horário de funcionamento e imagem — os dois sinais de SEO local', () => {
  /*
   * Os dois campos vinham de graça e não estavam sendo marcados: `perfilPublico` já carrega capa,
   * logo e horário padrão para DESENHAR a página. Sem eles a página do salão competia só pelo
   * nome — e este canal é o que o `docs/43-POSICIONAMENTO-10X.md` define como substituto da
   * vitrine central dos concorrentes, então perder o cartão rico custa exatamente onde dói.
   */
  it('cada linha de horário vira uma OpeningHoursSpecification com o dia certo', () => {
    const d = dadosEstruturadosDoSalao(BASE) as { openingHoursSpecification?: Record<string, string>[] }
    expect(d.openingHoursSpecification).toEqual([
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Monday', opens: '09:00', closes: '18:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Saturday', opens: '09:00', closes: '13:00' },
    ])
  })

  it('0 é domingo, não segunda — a convenção é a de `business_hours.weekday`', () => {
    /*
     * O erro clássico deste mapeamento, e ele não dá erro nenhum: `Temporal.dayOfWeek` é
     * 1=segunda…7=domingo, e o banco é 0=domingo…6=sábado. Trocar a régua desloca o salão inteiro
     * em um dia e anuncia horário errado no Google — marcação válida e mentirosa, que é pior que
     * marcação ausente.
     */
    const d = dadosEstruturadosDoSalao({
      ...BASE, horarios: [{ weekday: 0, opensAt: '10:00:00', closesAt: '14:00:00' }],
    }) as { openingHoursSpecification?: Record<string, string>[] }
    expect(d.openingHoursSpecification?.[0]?.dayOfWeek).toBe('https://schema.org/Sunday')
  })

  it('segundo turno no mesmo dia vira uma segunda entrada, não sobrescreve a primeira', () => {
    // Salão que fecha para o almoço tem duas linhas para o mesmo weekday — o schema.org aceita, e
    // colapsar em uma faria a tarde sumir ou o intervalo aparecer como se fosse expediente.
    const d = dadosEstruturadosDoSalao({
      ...BASE,
      horarios: [
        { weekday: 2, opensAt: '09:00:00', closesAt: '12:00:00' },
        { weekday: 2, opensAt: '14:00:00', closesAt: '19:00:00' },
      ],
    }) as { openingHoursSpecification?: Record<string, string>[] }
    expect(d.openingHoursSpecification).toHaveLength(2)
    expect(d.openingHoursSpecification?.map((h) => h.opens)).toEqual(['09:00', '14:00'])
  })

  it('weekday fora de 0-6 não vira entrada — marcação inválida custa mais que campo ausente', () => {
    const d = dadosEstruturadosDoSalao({
      ...BASE,
      horarios: [
        { weekday: 7, opensAt: '09:00:00', closesAt: '18:00:00' },
        { weekday: 3, opensAt: '09:00:00', closesAt: '18:00:00' },
      ],
    }) as { openingHoursSpecification?: Record<string, string>[] }
    expect(d.openingHoursSpecification).toHaveLength(1)
    expect(d.openingHoursSpecification?.[0]?.dayOfWeek).toBe('https://schema.org/Wednesday')
  })

  it('horário já em HH:MM passa igual — o corte não pode comer o minuto', () => {
    const d = dadosEstruturadosDoSalao({
      ...BASE, horarios: [{ weekday: 5, opensAt: '08:30', closesAt: '17:45' }],
    }) as { openingHoursSpecification?: Record<string, string>[] }
    expect(d.openingHoursSpecification?.[0]).toMatchObject({ opens: '08:30', closes: '17:45' })
  })

  it('a imagem entra como URL absoluta', () => {
    expect(dadosEstruturadosDoSalao(BASE).image).toBe('https://cdn.exemplo.com/vitrine/capa.webp')
  })
})
