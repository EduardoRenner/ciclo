import { Temporal } from '@js-temporal/polyfill'

/**
 * Mesma convenção de `business_hours.weekday`/`weekdayPg` em agendamentos.ts:
 * 0 = domingo … 6 = sábado. `Temporal.PlainDate.dayOfWeek` é 1 = segunda … 7 = domingo.
 */
function weekdayPg(dia: Temporal.PlainDate): number {
  return dia.dayOfWeek % 7
}

export type RegraRecorrencia =
  | { tipo: 'semanal'; weekday: number; intervaloSemanas: number }
  | { tipo: 'a_cada_dias'; intervaloDias: number }
  // ordinal: 1ª..4ª ocorrência do weekday no mês; 5 = a última do mês, exista ou não a 5ª.
  | { tipo: 'mensal_dia_semana'; weekday: number; ordinal: number }

export type LimiteSerie = { tipo: 'sem_fim' } | { tipo: 'ate_data'; data: string } | { tipo: 'numero_de_vezes'; total: number }

/** Todas as ocorrências do weekday num mês, em ordem — usado só por mensal_dia_semana. */
function ocorrenciasDoWeekdayNoMes(ano: number, mes: number, weekday: number): Temporal.PlainDate[] {
  const primeiroDia = Temporal.PlainDate.from({ year: ano, month: mes, day: 1 })
  const diasNoMes = primeiroDia.daysInMonth
  const datas: Temporal.PlainDate[] = []
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const data = primeiroDia.with({ day: dia })
    if (weekdayPg(data) === weekday) datas.push(data)
  }
  return datas
}

/**
 * Gera candidatos a partir de `inicio` (inclusive), respeitando o teto de segurança e o
 * horizonte de geração — função pura, sem I/O. Filtro por folga/conflito é responsabilidade
 * do chamador (precisa do banco, docs/09-PLATAFORMA.md §12 — série não é o mesmo que ocorrência
 * plantada: gerar a data não garante que ela vira agendamento).
 */
export function proximasDatas(params: {
  regra: RegraRecorrencia
  inicio: string // YYYY-MM-DD
  limite: LimiteSerie
  ocorrenciasJaGeradas: number
  horizonte: string // YYYY-MM-DD — não gera além disso
  tetoDeSeguranca: number
}): string[] {
  const { regra, limite, ocorrenciasJaGeradas, tetoDeSeguranca } = params
  const inicio = Temporal.PlainDate.from(params.inicio)
  const horizonte = Temporal.PlainDate.from(params.horizonte)
  const fimPeloLimite = limite.tipo === 'ate_data' ? Temporal.PlainDate.from(limite.data) : null

  const resultado: string[] = []
  let restantesPeloNumero = limite.tipo === 'numero_de_vezes' ? Math.max(0, limite.total - ocorrenciasJaGeradas) : Infinity

  const aceitar = (data: Temporal.PlainDate): boolean => {
    if (Temporal.PlainDate.compare(data, horizonte) > 0) return false
    if (fimPeloLimite && Temporal.PlainDate.compare(data, fimPeloLimite) > 0) return false
    return true
  }

  if (regra.tipo === 'a_cada_dias') {
    let data = inicio
    while (resultado.length < tetoDeSeguranca && restantesPeloNumero > 0) {
      if (!aceitar(data)) break
      resultado.push(data.toString())
      restantesPeloNumero--
      data = data.add({ days: regra.intervaloDias })
    }
    return resultado
  }

  if (regra.tipo === 'semanal') {
    let data = inicio
    while (weekdayPg(data) !== regra.weekday) data = data.add({ days: 1 })
    while (resultado.length < tetoDeSeguranca && restantesPeloNumero > 0) {
      if (!aceitar(data)) break
      resultado.push(data.toString())
      restantesPeloNumero--
      data = data.add({ days: 7 * regra.intervaloSemanas })
    }
    return resultado
  }

  // mensal_dia_semana
  let ano = inicio.year
  let mes = inicio.month
  let mesesTentados = 0
  while (resultado.length < tetoDeSeguranca && restantesPeloNumero > 0 && mesesTentados < 120) {
    mesesTentados++
    const ocorrencias = ocorrenciasDoWeekdayNoMes(ano, mes, regra.weekday)
    const alvo = regra.ordinal === 5 ? ocorrencias.at(-1) : ocorrencias[regra.ordinal - 1]
    if (alvo && Temporal.PlainDate.compare(alvo, inicio) >= 0) {
      if (!aceitar(alvo)) break
      resultado.push(alvo.toString())
      restantesPeloNumero--
    }
    mes++
    if (mes > 12) {
      mes = 1
      ano++
    }
  }
  return resultado
}

/** Um bloco de folga ocupa [start, end) em instante UTC — mesmo shape de `IntervaloOcupado`. */
export function ocorrenciaConflitaComFolga(
  startsAt: string,
  endsAt: string,
  folgas: { start: string; end: string }[],
): boolean {
  const inicio = Temporal.Instant.from(startsAt)
  const fim = Temporal.Instant.from(endsAt)
  return folgas.some((f) => {
    const fInicio = Temporal.Instant.from(f.start)
    const fFim = Temporal.Instant.from(f.end)
    return Temporal.Instant.compare(inicio, fFim) < 0 && Temporal.Instant.compare(fim, fInicio) > 0
  })
}
