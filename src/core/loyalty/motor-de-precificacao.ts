/**
 * CICLO Clube · C-02 (docs/60) — sugere de 1 a 3 planos de assinatura a partir do histórico real do
 * negócio, em vez do dono adivinhar preço e limite de uso.
 *
 * Não inventa número do nada: agrupa os clientes pela cadência que JÁ TÊM (`cicloPessoalDias`,
 * arredondado para sessões por mês — o mesmo dado que `client_cycles.personal_cycle_days` já guarda
 * para o Motor de Ciclo) e precifica cada grupo pelo ticket médio DELE. O único número de produto
 * que este arquivo assume é `DESCONTO_CLUBE_BPS` — a vantagem que justifica assinar em vez de pagar
 * avulso — e ele está registrado como decisão em `docs/60-PLANO-DE-IMPLEMENTACAO.md`.
 */

/** 15%: vantagem de assinar sobre pagar avulso. Decisão registrada em docs/60, não medida. */
export const DESCONTO_CLUBE_BPS = 1500

export type ClienteParaPrecificacao = {
  /** `client_cycles.personal_cycle_days` daquele cliente. */
  cicloPessoalDias: number
  /** Ticket médio daquele cliente, em centavos — o mesmo cálculo de `crm.ts` (`ltvCents / visitas`). */
  ticketMedioCents: number
}

export type SugestaoDePlano = {
  name: string
  sessionsPerMonth: number
  priceCents: number
  /** Quantos clientes da base já têm essa cadência — para o dono avaliar se vale oferecer. */
  clientesNaFaixa: number
}

const DIAS_NO_MES = 30

function sessoesPorMes(cicloPessoalDias: number): number {
  return Math.max(1, Math.round(DIAS_NO_MES / cicloPessoalDias))
}

/**
 * Ordena os `sessionsPerMonth` alcançados, sem números que o histórico não produziu: se ninguém
 * tem ciclo compatível com "3x por mês", nenhuma sugestão de 3x aparece.
 */
export function sugerirPlanos(clientes: readonly ClienteParaPrecificacao[]): SugestaoDePlano[] {
  if (clientes.length === 0) return []

  const porFaixa = new Map<number, ClienteParaPrecificacao[]>()
  for (const cliente of clientes) {
    const sessoes = sessoesPorMes(cliente.cicloPessoalDias)
    const grupo = porFaixa.get(sessoes) ?? []
    grupo.push(cliente)
    porFaixa.set(sessoes, grupo)
  }

  const faixas = [...porFaixa.entries()]
    .sort((a, b) => b[1].length - a[1].length) // maior grupo primeiro: é o de mais evidência
    .slice(0, 3)
    .sort((a, b) => a[0] - b[0]) // reordena por sessões crescente, pra tela listar em ordem

  return faixas.map(([sessoes, grupo]) => {
    // Mediana, não média: um outlier de ticket alto não pode inflar o preço sugerido do plano.
    const ticketsOrdenados = grupo.map((c) => c.ticketMedioCents).sort((a, b) => a - b)
    const ticketMedianoCents = ticketsOrdenados[Math.floor(ticketsOrdenados.length / 2)]!
    const precoCheioCents = ticketMedianoCents * sessoes
    const precoCents = Math.round((precoCheioCents * (10_000 - DESCONTO_CLUBE_BPS)) / 10_000)

    return {
      name: sessoes === 1 ? '1x por mês' : `${sessoes}x por mês`,
      sessionsPerMonth: sessoes,
      priceCents: precoCents,
      clientesNaFaixa: grupo.length,
    }
  })
}
