/**
 * G5 (docs/09-PLATAFORMA.md): `services.price_cents` sempre foi tratado como preço fechado —
 * não representa "por hora" (consultor), "visita + hora" (eletricista) nem "diária/meia diária"
 * (faxineira). A cobrança final de verdade já era flexível (ticket_items/quote_items aceitam
 * qty × preço unitário livre desde sempre); o que faltava era o CATÁLOGO conseguir anunciar o
 * preço do jeito certo — "R$ 50/hora" em vez de fingir "R$ 50" fechado.
 */
export type ModeloDePreco = 'fixed' | 'hourly' | 'visit_hourly' | 'daily' | 'quote'

export type ServicoComPreco = {
  pricingModel: ModeloDePreco
  priceCents: number
  hourlyRateCents: number | null
  halfDayPriceCents: number | null
}

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatarCentavos(cents: number): string {
  return dinheiro.format(cents / 100)
}

/** Texto pronto pra exibir no catálogo (admin) e na página pública — nunca esconde a unidade. */
export function formatarPreco(servico: ServicoComPreco): string {
  switch (servico.pricingModel) {
    /*
     * O quinto modelo, e o único que não anuncia número. Os outros quatro exigem um valor, então
     * quem não tem preço de tabela (eletricista, faxineira, quem faz obra) só conseguia cadastrar
     * mentindo. O eixo é o SERVIÇO e não a conta de propósito: negócio híbrido é o caso comum, e a
     * mesma pessoa que tem tabela de corte orça a obra. Ver docs/40.
     *
     * "Sob orçamento" e não "Consultar": consultar é o que a pessoa faz, sob orçamento é o que o
     * serviço é. O `'Consultar'` do `fixed` com preço zero logo abaixo continua existindo como rede
     * para cadastro antigo, mas deixou de ser o único jeito de dizer isto.
     */
    case 'quote':
      return 'Sob orçamento'

    case 'fixed':
      return servico.priceCents > 0 ? formatarCentavos(servico.priceCents) : 'Consultar'

    case 'hourly':
      return `${formatarCentavos(servico.priceCents)}/hora`

    case 'visit_hourly': {
      // Constraint do banco (services_visit_hourly_tem_taxa) garante hourlyRateCents != null aqui.
      const taxa = servico.hourlyRateCents ?? 0
      return `${formatarCentavos(servico.priceCents)} (visita) + ${formatarCentavos(taxa)}/hora`
    }

    case 'daily':
      return servico.halfDayPriceCents != null
        ? `${formatarCentavos(servico.priceCents)} (diária) · ${formatarCentavos(servico.halfDayPriceCents)} (meia diária)`
        : `${formatarCentavos(servico.priceCents)} (diária)`
  }
}

/**
 * Estimativa pra mostrar ANTES de agendar (nunca é a cobrança final — essa sempre nasce de
 * `ticket_items`/`quote_items` no fechamento, com a duração real do trabalho). Só faz sentido
 * pra `hourly`: multiplica pela duração cadastrada do serviço, o mesmo número que já governa o
 * slot na agenda hoje.
 */
export function estimativaParaDuracao(servico: ServicoComPreco, duracaoMin: number): number {
  // Sob orçamento não tem o que estimar: `price_cents` é ignorado neste modelo, e devolver o
  // conteúdo dele daria um número que ninguém escreveu como preço.
  if (servico.pricingModel === 'quote') return 0
  if (servico.pricingModel === 'hourly') return porHora(duracaoMin, servico.priceCents)
  if (servico.pricingModel === 'visit_hourly') return servico.priceCents + porHora(duracaoMin, servico.hourlyRateCents ?? 0)
  return servico.priceCents
}

/**
 * Multiplica ANTES de dividir, e a ordem não é estilo.
 *
 * Era `Math.ceil((duracaoMin / 60) * centsPorHora)`. `duracaoMin / 60` quase nunca tem
 * representação binária exata — 23/60 vira um número um fio acima do valor real — e o `ceil` pega
 * essa sobra e vira um centavo. Medido: **4.654 combinações** de duração (1–480 min) e preço
 * (R$ 10–R$ 300) em que a estimativa sai um centavo ACIMA do valor correto. 23 min a R$ 12/h dá
 * 461, e o certo é 460.
 *
 * Fazendo a multiplicação primeiro, `duracaoMin * centsPorHora` é inteiro exato e a divisão por 60
 * só arredonda uma vez, na direção declarada. `core/pricing/sinal.ts` já usava esta ordem para o
 * sinal em basis points — esta função é que estava fora do padrão da casa.
 *
 * O erro é de um centavo e sempre contra quem paga. Não quebra nada; só não é o número que o
 * serviço diz cobrar, e é a estimativa que a pessoa lê antes de decidir agendar.
 */
function porHora(duracaoMin: number, centsPorHora: number): number {
  return Math.ceil((duracaoMin * centsPorHora) / 60)
}
