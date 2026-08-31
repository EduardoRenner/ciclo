/**
 * JSON-LD da página pública do salão — o que faz o Google mostrar telefone, endereço, faixa de
 * preço e estrelas no resultado, em vez de um link seco.
 *
 * Isto é SEO local, que é o único SEO que importa para este produto: ninguém procura "barbearia"
 * no mundo, procura "barbearia perto de mim". Sem dados estruturados, a página do salão compete só
 * pelo texto; com eles, entra nos resultados ricos.
 */
export type ServicoParaSeo = { name: string; priceCents: number | null; pricingModel: string }

export type EntradaSeoDoSalao = {
  nome: string
  url: string
  vertical: string
  descricao: string | null
  telefone: string | null
  endereco: string | null
  instagram: string | null
  servicos: ServicoParaSeo[]
  avaliacoes: { average: number; count: number }
}

/**
 * `vertical_pack` → tipo do schema.org. Dizer "BeautySalon" para uma barbearia é perder a
 * especificidade que o buscador usa para casar com a intenção de quem procura — e `LocalBusiness`
 * puro é o mesmo que não dizer nada.
 */
const TIPO_POR_VERTICAL: Record<string, string> = {
  barber: 'HairSalon',
  hair: 'HairSalon',
  nails: 'NailSalon',
  lashes: 'BeautySalon',
  brows: 'BeautySalon',
  waxing: 'BeautySalon',
  aesthetics: 'BeautySalon',
  tattoo: 'TattooParlor',
}

export function dadosEstruturadosDoSalao(e: EntradaSeoDoSalao): Record<string, unknown> {
  const dados: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': TIPO_POR_VERTICAL[e.vertical] ?? 'HealthAndBeautyBusiness',
    name: e.nome,
    url: e.url,
  }

  if (e.descricao) dados.description = e.descricao
  if (e.telefone) dados.telephone = e.telefone
  // `address` é texto livre no cadastro, então vai como `streetAddress` de um PostalAddress em vez
  // de fingir que temos cidade, estado e CEP separados. Inventar campo estruturado a partir de uma
  // string única daria endereço errado em resultado rico — pior que endereço ausente.
  if (e.endereco) dados.address = { '@type': 'PostalAddress', streetAddress: e.endereco }
  if (e.instagram) dados.sameAs = [e.instagram]

  /*
   * `aggregateRating` só entra quando existe avaliação DE VERDADE. Com `ratingCount: 0` o Google
   * trata como marcação inválida e pode desqualificar o resultado rico inteiro da página — o
   * oposto do que este arquivo existe para fazer. Salão novo simplesmente não tem estrelas ainda.
   */
  if (e.avaliacoes.count > 0 && e.avaliacoes.average > 0) {
    dados.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: e.avaliacoes.average,
      reviewCount: e.avaliacoes.count,
      bestRating: 5,
      worstRating: 1,
    }
  }

  // Só serviço com preço FIXO vira oferta: "por hora" e "diária" precisam de contexto que a
  // marcação não carrega, e anunciar o valor da hora como se fosse o preço do serviço faria a
  // busca mostrar um número que a cliente não vai pagar.
  const comPrecoFixo = e.servicos.filter((s) => s.pricingModel === 'fixed' && s.priceCents !== null && s.priceCents > 0)
  if (comPrecoFixo.length > 0) {
    dados.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: 'Serviços',
      itemListElement: comPrecoFixo.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.name },
        price: (s.priceCents! / 100).toFixed(2),
        priceCurrency: 'BRL',
      })),
    }
    const precos = comPrecoFixo.map((s) => s.priceCents!)
    dados.priceRange = `R$ ${(Math.min(...precos) / 100).toFixed(0)} - R$ ${(Math.max(...precos) / 100).toFixed(0)}`
  }

  return dados
}
