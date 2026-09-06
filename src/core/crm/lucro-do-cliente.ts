/**
 * `docs/48` C2 — quanto cada pessoa deixa de LUCRO, e não de faturamento.
 *
 * ## Por que é uma categoria nova, e não uma coluna a mais
 *
 * `docs/47` P01: *"pergunte a dez donos de barbearia quanto eles ganham por corte e nove vão
 * responder o preço do corte"*. A ficha do cliente deste produto fazia a mesma coisa: "Valor
 * atendido" é a soma dos preços. Um cliente de progressiva a R$ 300 com 60% de comissão aparecia
 * como o mais valioso da base, acima de um de corte semanal a R$ 50 sem comissão — e o segundo
 * deixa mais dinheiro no fim do ano.
 *
 * ## De onde sai o número, e por que ele às vezes é parcial
 *
 * Do lucro **congelado** das comandas fechadas daquela pessoa (`tickets.profit_cents`) — nunca de
 * um segundo cálculo, para bater com o caixa. Só que nem toda visita passa por comanda: o
 * atendimento pode ser concluído sem que ninguém abra uma. Então o resultado carrega a cobertura,
 * e a tela diz de quantas visitas está falando. Um lucro de 3 comandas apresentado como o valor da
 * pessoa inteira seria o mesmo erro do "Sobrou" sem taxa — parcial com cara de completo.
 *
 * ## O anual
 *
 * `docs/48` C2 define: C1 × ciclo de retorno. Com o lucro médio por visita e a cadência daquela
 * pessoa (`client_cycles.personal_cycle_days`), o ano se projeta. Sem ciclo medido não há projeção
 * — e `null` aqui é a resposta certa, não zero.
 */

export type EntradaLucroDoCliente = {
  /** Soma de `tickets.profit_cents` das comandas fechadas dessa pessoa. */
  lucroCents: number
  /** Quantas comandas fechadas entraram nessa soma. */
  comandas: number
  /** Atendimentos concluídos — o denominador honesto. */
  visitas: number
  /** `client_cycles.personal_cycle_days` do serviço principal. `null` = sem cadência medida. */
  cicloPessoalDias: number | null
}

export type LucroDoCliente = {
  lucroCents: number
  /** `null` quando nenhuma comanda foi fechada: dividir por zero daria NaN na tela. */
  lucroPorVisitaCents: number | null
  /** Projeção anual. `null` sem cadência medida ou sem comanda — não se projeta o que não se mediu. */
  lucroAnualCents: number | null
  visitasSemComanda: number
  cobertura: 'completa' | 'parcial' | 'nenhuma'
}

const DIAS_NO_ANO = 365

export function lucroDoCliente(entrada: EntradaLucroDoCliente): LucroDoCliente {
  const visitasSemComanda = Math.max(0, entrada.visitas - entrada.comandas)

  const cobertura: LucroDoCliente['cobertura'] =
    entrada.comandas === 0 ? 'nenhuma' : visitasSemComanda === 0 ? 'completa' : 'parcial'

  const lucroPorVisitaCents = entrada.comandas > 0 ? Math.round(entrada.lucroCents / entrada.comandas) : null

  /*
   * A projeção usa o lucro médio POR COMANDA, não por visita concluída: dividir pelo total de
   * visitas quando metade delas não tem comanda produziria uma média artificialmente baixa e uma
   * projeção anual errada para menos — que é o erro menos visível dos dois, porque não parece
   * otimista.
   */
  const lucroAnualCents =
    lucroPorVisitaCents !== null && entrada.cicloPessoalDias !== null && entrada.cicloPessoalDias > 0
      ? Math.round(lucroPorVisitaCents * (DIAS_NO_ANO / entrada.cicloPessoalDias))
      : null

  return { lucroCents: entrada.lucroCents, lucroPorVisitaCents, lucroAnualCents, visitasSemComanda, cobertura }
}
