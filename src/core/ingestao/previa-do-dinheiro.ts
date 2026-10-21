/**
 * docs/103 CNV-021 · "84 sumiram, ≈ R$ X parado, estes 10 primeiro" ANTES de gravar.
 *
 * Não é uma segunda fórmula: é a MESMA conta que a importação grava em `client_cycles`
 * (`preverEPersistirCiclos`) e que a Hoje soma em "Dá para recuperar": `computeCycle` com a última
 * visita e o ritmo do serviço escolhido, e `valorEmRiscoCents` com o preço dele. Por isso o número da
 * prévia é o que a Hoje mostra logo depois de gravar (até o recálculo noturno calibrar a chance de
 * volta pelo histórico do salão).
 *
 * Quem veio sem última visita não entra na conta, e a tela diz quantos são: sem data não há de quando
 * prever (nada de inventar).
 */
import { Temporal } from '@js-temporal/polyfill'

import { computeCycle } from '@/core/cycle/compute'
import { valorEmRiscoCents } from '@/core/cycle/valor-em-risco'

import type { RegistroCanonico } from '@/core/ingestao/esteira'

export type ServicoDaPrevia = { priceCents: number; cycleDays: number }

export type PessoaParaChamar = { nome: string; ultimaVisita: string; diasDeAtraso: number; valorCents: number }

export type PreviaDoDinheiro = {
  /** Com última visita: o Motor passa a acompanhar. */
  comData: number
  semData: number
  /** Já passaram do ritmo (qualquer estado que não "em dia"). */
  sumidos: number
  valorCents: number
  /** Os que mais valem chamar primeiro (maior valor; no empate, quem está há menos tempo fora, que volta mais). */
  primeiros: PessoaParaChamar[]
}

export function previaDoDinheiro(registros: readonly RegistroCanonico[], servico: ServicoDaPrevia, hoje: string, quantos = 10): PreviaDoDinheiro {
  const dia = Temporal.PlainDate.from(hoje)
  let comData = 0
  const sumidos: PessoaParaChamar[] = []
  for (const r of registros) {
    if (!r.ultimaVisita) continue
    comData++
    const c = computeCycle({ history: [{ date: Temporal.PlainDate.from(r.ultimaVisita) }], defaultCycleDays: servico.cycleDays, today: dia })
    if (c.state === 'on_track') continue
    sumidos.push({ nome: r.nome, ultimaVisita: r.ultimaVisita, diasDeAtraso: c.lateDays, valorCents: valorEmRiscoCents(servico.priceCents, c.state) })
  }
  const ordenados = [...sumidos].sort((a, b) => b.valorCents - a.valorCents || a.diasDeAtraso - b.diasDeAtraso)
  return {
    comData,
    semData: registros.length - comData,
    sumidos: sumidos.length,
    valorCents: sumidos.reduce((s, p) => s + p.valorCents, 0),
    primeiros: ordenados.slice(0, quantos),
  }
}
