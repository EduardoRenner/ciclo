/**
 * APR-014 (achado C-03): se uma visita gerou venda avulsa — e por isso conta como receita que o
 * Motor trouxe — ou se já estava paga por outro meio (pacote ou clube).
 *
 * A regra antiga olhava o estado de HOJE: "tem pacote com saldo hoje" ou "assinatura ativa hoje".
 * Quando a última sessão era consumida, as visitas antigas pagas pelo pacote viravam "preço cheio"
 * e "o Motor trouxe" CRESCIA sozinho. A regra agora é sobre o dia da visita, e não muda depois:
 *
 * - sessão de pacote usada NESSA visita (`package_uses.appointment_id`);
 * - sessão de pacote usada sem vínculo com horário, do mesmo cliente e serviço, NO MESMO DIA (o
 *   "Usar 1 sessão" da ficha não liga ao horário);
 * - assinatura do clube vigente NAQUELE DIA (`started_on` ≤ dia, e sem `canceled_on` ou depois).
 */
export type UsoDePacote = { appointmentId: string | null; clientId: string; serviceId: string; dia: string }
export type AssinaturaDoClube = { clientId: string; inicio: string; fim: string | null }
export type VisitaParaAtribuir = { id: string; clientId: string; serviceId: string; dia: string }

export type PagamentosPorOutroMeio = {
  visitasComPacote: Set<string>
  usosSemVinculo: Set<string>
  assinaturas: Map<string, { inicio: string; fim: string | null }[]>
}

export function montarPagamentosPorOutroMeio(usos: readonly UsoDePacote[], assinaturas: readonly AssinaturaDoClube[]): PagamentosPorOutroMeio {
  const visitasComPacote = new Set<string>()
  const usosSemVinculo = new Set<string>()
  for (const u of usos) {
    if (u.appointmentId) visitasComPacote.add(u.appointmentId)
    else usosSemVinculo.add(`${u.clientId}:${u.serviceId}:${u.dia}`)
  }
  const porCliente = new Map<string, { inicio: string; fim: string | null }[]>()
  for (const a of assinaturas) {
    const lista = porCliente.get(a.clientId) ?? []
    lista.push({ inicio: a.inicio, fim: a.fim })
    porCliente.set(a.clientId, lista)
  }
  return { visitasComPacote, usosSemVinculo, assinaturas: porCliente }
}

/** Datas em `YYYY-MM-DD`: a comparação de texto ordena igual à de data. */
export function visitaSemVendaAvulsa(visita: VisitaParaAtribuir, pagos: PagamentosPorOutroMeio): boolean {
  if (pagos.visitasComPacote.has(visita.id)) return true
  if (pagos.usosSemVinculo.has(`${visita.clientId}:${visita.serviceId}:${visita.dia}`)) return true
  return (pagos.assinaturas.get(visita.clientId) ?? []).some((a) => a.inicio <= visita.dia && (a.fim === null || visita.dia < a.fim))
}
