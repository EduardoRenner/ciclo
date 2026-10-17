import { Temporal } from '@js-temporal/polyfill'

/**
 * Protocolo de saúde do animal (`docs/105-ciclo/C-010`, trilha de expansão pet).
 *
 * No pet há dois tipos de ciclo. HÁBITO (banho, tosa): o ritmo é do tutor, e quem prevê é o Motor
 * (`computeCycle` por sujeito, C-003). PROTOCOLO (vacina, vermífugo, antipulgas): o intervalo é de
 * calendário, definido pelo veterinário — o sistema não decide saúde, lembra o protocolo da casa.
 * Os padrões abaixo são o ponto de partida mais comum no Brasil, com fonte; o protocolo da clínica
 * substitui qualquer um deles (`intervalos`).
 *
 * Fontes (C-010/00-ciclo.md): WSAVA 2024 (série do filhote a cada 2–4 semanas até 16+ semanas);
 * prática brasileira de reforço anual da polivalente e da antirrábica (obrigatória por lei municipal
 * em muitas cidades); ESCCAP (vermífugo ≥ 4×/ano quando o risco não é conhecido; por grupo de risco).
 */

export type ItemDoPet = 'vacina_polivalente' | 'antirrabica' | 'vermifugo' | 'antipulgas'

export const NOMES_DOS_ITENS: Record<ItemDoPet, string> = {
  vacina_polivalente: 'vacina polivalente',
  antirrabica: 'vacina antirrábica',
  vermifugo: 'vermífugo',
  antipulgas: 'antipulgas',
}

/** Grupos de risco do ESCCAP para vermífugo: A (só dentro de casa) a D (caça, come de tudo). */
export type GrupoDeRisco = 'A' | 'B' | 'C' | 'D'

export const INTERVALOS_PADRAO = {
  /** Série do filhote: uma dose a cada 21 dias, a primeira com 6 semanas, até uma dose com 16+ semanas. */
  serieDoFilhoteDias: 21,
  primeiraDosePolivalenteDias: 42,
  fimDaSerieDias: 112,
  primeiraAntirrabicaDias: 84,
  reforcoAnualDias: 365,
  /** Filhote até 6 meses: vermífugo mensal; primeira dose com 2 semanas. */
  vermifugoFilhoteDias: 30,
  primeiroVermifugoDias: 14,
  filhoteAteDias: 183,
  vermifugoPorGrupo: { A: 182, B: 91, C: 61, D: 30 } as Record<GrupoDeRisco, number>,
  /** Antipulgas: a duração vem do produto aplicado (comprimido de 12 semanas = 84); sem produto, 30. */
  antipulgasPadraoDias: 30,
}

export type Intervalos = typeof INTERVALOS_PADRAO

export type EntradaDoProtocolo = {
  item: ItemDoPet
  /** Data de nascimento, se o tutor souber. Sem ela, um animal sem registro vira "perguntar". */
  nascimento: Temporal.PlainDate | null
  /** Aplicações registradas NESTA casa (ou informadas pelo tutor), em qualquer ordem. */
  aplicacoes: readonly { date: Temporal.PlainDate; duracaoDias?: number }[]
  grupoDeRisco?: GrupoDeRisco
  hoje: Temporal.PlainDate
  janelaDias?: number
  intervalos?: Partial<Intervalos>
}

export type EstadoDoItemDoPet = 'vencido' | 'nesta_visita' | 'em_dia' | 'perguntar'

export type VencimentoDoPet = {
  item: ItemDoPet
  estado: EstadoDoItemDoPet
  venceEm: Temporal.PlainDate | null
  /** O porquê, em palavras do tutor: "2ª dose da série do filhote", "reforço anual". */
  motivo: string
}

const dias = (de: Temporal.PlainDate, ate: Temporal.PlainDate) => de.until(ate).total('days')

function proxima(e: EntradaDoProtocolo, iv: Intervalos): { venceEm: Temporal.PlainDate; motivo: string } | null {
  const doses = [...e.aplicacoes].sort((a, b) => Temporal.PlainDate.compare(a.date, b.date))
  const ultima = doses[doses.length - 1]
  const idade = (data: Temporal.PlainDate) => (e.nascimento ? dias(e.nascimento, data) : null)

  switch (e.item) {
    case 'vacina_polivalente': {
      if (!ultima) return e.nascimento ? { venceEm: e.nascimento.add({ days: iv.primeiraDosePolivalenteDias }), motivo: '1ª dose da série do filhote' } : null
      // Série completa: alguma dose com 16+ semanas, ou idade desconhecida (adulto que chegou já vacinado).
      const serieCompleta = !e.nascimento || doses.some((d) => (idade(d.date) ?? 0) >= iv.fimDaSerieDias)
      if (serieCompleta) return { venceEm: ultima.date.add({ days: iv.reforcoAnualDias }), motivo: 'reforço anual' }
      return { venceEm: ultima.date.add({ days: iv.serieDoFilhoteDias }), motivo: `${doses.length + 1}ª dose da série do filhote` }
    }
    case 'antirrabica': {
      if (!ultima) return e.nascimento ? { venceEm: e.nascimento.add({ days: iv.primeiraAntirrabicaDias }), motivo: '1ª dose' } : null
      return { venceEm: ultima.date.add({ days: iv.reforcoAnualDias }), motivo: 'reforço anual' }
    }
    case 'vermifugo': {
      if (!ultima) {
        const filhote = e.nascimento !== null && dias(e.nascimento, e.hoje) < iv.filhoteAteDias
        return filhote ? { venceEm: e.nascimento!.add({ days: iv.primeiroVermifugoDias }), motivo: '1ª dose do filhote' } : null
      }
      const filhote = (idade(ultima.date) ?? Infinity) < iv.filhoteAteDias
      if (filhote) return { venceEm: ultima.date.add({ days: iv.vermifugoFilhoteDias }), motivo: 'dose mensal do filhote' }
      const grupo = e.grupoDeRisco ?? 'B'
      return { venceEm: ultima.date.add({ days: iv.vermifugoPorGrupo[grupo] }), motivo: grupo === 'B' ? 'a cada 3 meses' : `pelo risco do animal (grupo ${grupo})` }
    }
    case 'antipulgas': {
      if (!ultima) return null
      return { venceEm: ultima.date.add({ days: ultima.duracaoDias ?? iv.antipulgasPadraoDias }), motivo: 'fim da proteção do produto aplicado' }
    }
  }
}

export function vencimentoDoPet(e: EntradaDoProtocolo): VencimentoDoPet {
  const iv: Intervalos = { ...INTERVALOS_PADRAO, ...e.intervalos }
  const p = proxima(e, iv)
  // Sem registro e sem idade, a casa não sabe se foi feito em outro lugar: pergunta, não acusa.
  if (!p) return { item: e.item, estado: 'perguntar', venceEm: null, motivo: 'sem registro: vale perguntar ao tutor' }
  const janela = e.janelaDias ?? 7
  const estado: EstadoDoItemDoPet =
    Temporal.PlainDate.compare(p.venceEm, e.hoje) <= 0
      ? 'vencido'
      : Temporal.PlainDate.compare(p.venceEm, e.hoje.add({ days: janela })) <= 0
        ? 'nesta_visita'
        : 'em_dia'
  return { item: e.item, estado, venceEm: p.venceEm, motivo: p.motivo }
}
