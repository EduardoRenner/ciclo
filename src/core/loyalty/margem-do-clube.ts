import { Temporal } from '@js-temporal/polyfill'

/**
 * `docs/48` C6 — a margem viva do clube de assinatura.
 *
 * ## O buraco que isto ocupa
 *
 * `docs/47` P06, citando a pesquisa de mercado: *"receita antecipada não é lucro antecipado"*. No
 * plano ilimitado — o formato que a barbearia brasileira mais usa — **basta uma parcela dos
 * assinantes usar acima da média e a margem despenca, sem aviso prévio**. Trinks, BestBarbers,
 * Gendo e AppBarber vendem clube de assinatura; nenhum deles avisa quando um assinante virou
 * prejuízo (`docs/47` D-D).
 *
 * ## Por que o custo é calculado, e por que isso não é "número inventado"
 *
 * A visita de assinante não passa por comanda: ela já está paga pela mensalidade. Então não existe
 * `tickets.profit_cents` para ler. O custo é montado com as mesmas duas peças que o fechamento de
 * comanda usa, e as duas são **configuradas pelo dono**, não estimadas por nós:
 *
 * - a comissão do profissional que atendeu (`professional_services.commission_bps`, ou o do
 *   profissional), aplicada ao preço do serviço — a mesma conta de `calcularComissaoItem`;
 * - o material, da ficha de consumo × custo médio do produto — o mesmo `custoDoServico`.
 *
 * O que falta continua faltando em voz alta: serviço sem ficha entra com material zero, e o
 * resultado carrega quantos foram, para a tela dizer o que ainda não está na conta.
 */

export type VisitaDoAssinante = {
  /** Comissão + material daquela visita, em centavos. Quem monta é o servidor. */
  custoCents: number
  /** O serviço daquela visita não tem ficha de consumo — o material dele não entrou. */
  semFicha: boolean
}

export type MargemDoAssinante = {
  mensalidadeCents: number
  visitas: number
  custoCents: number
  /** Mensalidade menos o custo de servir. Negativo = o clube está pagando para atender. */
  margemCents: number
  noPrejuizo: boolean
  /** `null` = plano ilimitado, que é justamente o formato onde P06 acontece. */
  limiteSessoes: number | null
  acimaDoLimite: boolean
  /** Quantas visitas entraram sem o material contado. */
  visitasSemFicha: number
}

export function margemDoAssinante(
  mensalidadeCents: number,
  limiteSessoes: number | null,
  visitas: readonly VisitaDoAssinante[],
): MargemDoAssinante {
  const custoCents = visitas.reduce((soma, v) => soma + v.custoCents, 0)
  const margemCents = mensalidadeCents - custoCents

  return {
    mensalidadeCents,
    visitas: visitas.length,
    custoCents,
    margemCents,
    noPrejuizo: margemCents < 0,
    limiteSessoes,
    /*
      Passar do limite não é o mesmo que dar prejuízo, e os dois precisam existir separados: um
      plano de 4 sessões com a quinta visita cortesia continua lucrativo, e um ilimitado pode
      afundar sem estourar limite nenhum — não há limite para estourar. Juntar os dois num "alerta"
      só faria o caso do ilimitado, que é o que a pesquisa aponta como o perigoso, sumir.
    */
    acimaDoLimite: limiteSessoes !== null && visitas.length > limiteSessoes,
    visitasSemFicha: visitas.filter((v) => v.semFicha).length,
  }
}

/**
 * A janela da cobrança corrente: do dia de cobrança mais recente até o próximo.
 *
 * `billing_day` é 1..28 por construção (`0019`), então nenhum mês fica sem esse dia — foi por isso
 * que o limite existe, e é o que permite somar um mês sem tratar fevereiro.
 */
export function janelaDeCobranca(billingDay: number, hoje: Temporal.PlainDate): { inicio: Temporal.PlainDate; fim: Temporal.PlainDate } {
  const desteMes = hoje.with({ day: billingDay })
  const inicio = Temporal.PlainDate.compare(hoje, desteMes) >= 0 ? desteMes : desteMes.subtract({ months: 1 })
  return { inicio, fim: inicio.add({ months: 1 }) }
}
