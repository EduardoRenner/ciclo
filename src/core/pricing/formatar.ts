/**
 * G5 (docs/09-PLATAFORMA.md): `services.price_cents` sempre foi tratado como preço fechado —
 * não representa "por hora" (consultor), "visita + hora" (eletricista) nem "diária/meia diária"
 * (faxineira). A cobrança final de verdade já era flexível (ticket_items/quote_items aceitam
 * qty × preço unitário livre desde sempre); o que faltava era o CATÁLOGO conseguir anunciar o
 * preço do jeito certo — "R$ 50/hora" em vez de fingir "R$ 50" fechado.
 */
export type ModeloDePreco = 'fixed' | 'hourly' | 'visit_hourly' | 'daily'

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
  if (servico.pricingModel === 'hourly') return Math.ceil((duracaoMin / 60) * servico.priceCents)
  if (servico.pricingModel === 'visit_hourly') return servico.priceCents + Math.ceil((duracaoMin / 60) * (servico.hourlyRateCents ?? 0))
  return servico.priceCents
}
