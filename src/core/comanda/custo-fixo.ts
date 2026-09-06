/**
 * O que a hora de cadeira custa antes de qualquer atendimento acontecer.
 *
 * ## O buraco, medido em 2026-09-06
 *
 * O "Sobrou" do CICLO é `receita − material − taxa − comissão`. Não desconta aluguel, luz, água,
 * internet nem software. Não existe uma linha em `src/` nem uma coluna no banco para isso —
 * conferido: a única ocorrência de "aluguel" no projeto é `professionals.rent_cents`, que é o
 * modelo de cadeira alugada e entra como RECEITA do salão, não como custo dele.
 *
 * Ou seja: o número que o produto chama de "Sobrou" é **margem de contribuição**, não lucro. Num
 * corte de R$ 45 com 40% de comissão, ele diz "Sobrou R$ 24,00" — e o dono que paga R$ 3.500 de
 * aluguel lê isso como o dinheiro que ficou. A `docs/47` P05 acusa o setor de mostrar faturamento
 * com cara de lucro; mostrar margem de contribuição com cara de lucro é a mesma família, um degrau
 * acima.
 *
 * ## Por que três perguntas, e não uma planilha
 *
 * A tese do `docs/48` §Fase 3 é que o dono não sabe calcular o custo de um serviço (73%, `47` P02),
 * mas sabe de cabeça o que paga de aluguel. As três perguntas — quanto sai por mês, quantas horas o
 * salão fica aberto, quantas cadeiras — são as que ele responde sem consultar nada, e delas sai o
 * custo de uma hora de UMA cadeira. Pedir mais que isso é pedir a planilha que ele não tem.
 *
 * ## O que esta função NÃO faz
 *
 * Não inventa. Sem as três respostas ela devolve `null`, e `null` não é zero: um salão que não
 * informou o aluguel tem custo fixo desconhecido, não custo fixo nenhum. Quem transforma isso em
 * lacuna na tela é `explicarSobra`, do mesmo jeito que faz com a taxa da maquininha.
 */

export type CustoFixoDoTenant = {
  /** Aluguel + contas + software, tudo que sai todo mês independente de atender. */
  mensalCents: number
  /** Horas que o salão fica aberto no mês. Um salão 9h-19h de seg a sáb dá ~260. */
  horasPorMes: number
  /** Postos de atendimento simultâneo. Divide o custo: duas cadeiras, metade por hora cada. */
  cadeiras: number
}

/**
 * `null` quando falta qualquer uma das três respostas, ou quando alguma delas torna a conta
 * impossível. Zero horas abertas não é "custo infinito por hora": é uma resposta que ainda não faz
 * sentido, e a tela precisa dizer isso em vez de exibir um número.
 */
export function lerCustoFixo(settings: unknown): CustoFixoDoTenant | null {
  const raiz = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).custo_fixo : null
  if (!raiz || typeof raiz !== 'object') return null

  const obj = raiz as Record<string, unknown>
  const mensalCents = obj.mensal_cents
  const horasPorMes = obj.horas_por_mes
  const cadeiras = obj.cadeiras

  /*
   * `typeof === 'number'` e não `Number(x)`: `Number(null)` e `Number('')` são 0, e zero é resposta
   * legítima para o valor mensal (um profissional que atende em casa). A coerção transformaria
   * "nunca respondeu" em "respondeu zero" — a mesma porta que `bpsOuZero` fecha na taxa.
   */
  if (typeof mensalCents !== 'number' || !Number.isFinite(mensalCents) || mensalCents < 0) return null
  if (typeof horasPorMes !== 'number' || !Number.isFinite(horasPorMes) || horasPorMes <= 0) return null
  if (typeof cadeiras !== 'number' || !Number.isFinite(cadeiras) || cadeiras < 1) return null

  return { mensalCents: Math.round(mensalCents), horasPorMes, cadeiras: Math.round(cadeiras) }
}

/** A presença da chave é o carimbo de que o dono abriu a tela e salvou — igual à taxa. */
export function custoFixoEstaConfigurado(settings: unknown): boolean {
  const raiz = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).custo_fixo : null
  return Boolean(raiz) && typeof raiz === 'object'
}

/**
 * Quanto custa uma hora de UMA cadeira. Sem arredondar aqui: o arredondamento acontece uma vez, no
 * custo do atendimento, senão um salão com muitos atendimentos curtos acumula centavos de erro.
 */
export function custoPorHoraDaCadeira(custo: CustoFixoDoTenant): number {
  return custo.mensalCents / custo.horasPorMes / custo.cadeiras
}

/**
 * O custo fixo de UM atendimento: o tempo que ele ocupa a cadeira, ao preço da hora.
 *
 * A duração vem do catálogo (`services.duration_min`) porque é o que o salão reservou — o relógio
 * real do atendimento não é registrado em lugar nenhum, e inventar uma média seria pior que usar a
 * agenda, que é a decisão que o próprio dono tomou ao cadastrar o serviço.
 */
export function custoFixoDoAtendimento(custo: CustoFixoDoTenant | null, duracaoTotalMin: number): number {
  if (custo === null || duracaoTotalMin <= 0) return 0
  return Math.max(0, Math.round((custoPorHoraDaCadeira(custo) * duracaoTotalMin) / 60))
}
