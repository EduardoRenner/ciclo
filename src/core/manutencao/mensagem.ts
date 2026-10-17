import { Temporal } from '@js-temporal/polyfill'

import { ITENS, type ChaveDoItem } from './itens'
import type { VencimentoDoItem } from './vencimento'

/**
 * A mensagem que diz o relógio (`docs/106-automotivo` §2.2 passo 6, aposta A-12, trilha 5 do 105).
 *
 * "Já faz um tempo, quer trazer o carro?" é genérico e soa como venda. "Pela quilometragem, o Onix
 * deve estar perto da troca de óleo (faltam ~500 km)" é um fato que o motorista confere no painel.
 * A mensagem só afirma o que o Motor sabe:
 * - km medido (2+ leituras) → "faltam ~N km"; ritmo de referência → "pela média de uso", sem número;
 * - tempo → quantos meses desde a última troca;
 * - desgaste → o valor medido na última visita;
 * - item sem histórico → "vale conferir", nunca "venceu".
 * Não promete canal nem envio: é o TEXTO; quem manda e por onde é decisão de quem chama (regra do
 * CLAUDE.md sobre prometer canal). Não supõe gênero de ninguém.
 */

export type EntradaDaMensagem = {
  nomeDoCliente: string
  /** Como o veículo é chamado: "o Onix", "a moto". */
  veiculo: string
  itens: readonly VencimentoDoItem[]
  /** Km da última leitura, para "faltam ~N km". */
  kmAtual: number | null
  hoje: Temporal.PlainDate
  /** Horário livre sugerido, já formatado no fuso do negócio ("sexta, às 8h"). */
  horarioSugerido?: string | null
  nomeDoNegocio: string
}

export const MAXIMO_DE_ITENS_NA_MENSAGEM = 3

function arredondarKm(km: number): number {
  return km >= 1000 ? Math.round(km / 100) * 100 : Math.max(50, Math.round(km / 50) * 50)
}

function mesesEntre(de: Temporal.PlainDate, ate: Temporal.PlainDate): number {
  return Math.max(1, Math.round(de.until(ate, { largestUnit: 'months' }).total({ unit: 'months', relativeTo: de })))
}

/** O motivo de UM item, em uma frase curta que o motorista pode conferir. */
export function motivoDoItem(v: VencimentoDoItem, kmAtual: number | null, hoje: Temporal.PlainDate, ultimaTroca?: Temporal.PlainDate | null): string {
  const nome = ITENS[v.item].nome.toLowerCase()
  const venceu = v.estado === 'vencido'
  if (v.estado === 'perguntar') return `${nome}: não temos registro da última troca, vale conferir`
  if (v.relogio === 'uso') {
    if (v.ritmo.origem === 'medido' && v.kmDeVencimento !== null && kmAtual !== null) {
      const faltam = v.kmDeVencimento - kmAtual
      return faltam <= 0 ? `${nome}: passou da quilometragem` : `${nome}: pela quilometragem, faltam ~${arredondarKm(faltam).toLocaleString('pt-BR')} km`
    }
    return venceu ? `${nome}: pela média de uso, já deve ter passado da quilometragem` : `${nome}: pela média de uso, deve estar perto da quilometragem`
  }
  if (v.relogio === 'tempo') {
    const meses = ultimaTroca ? mesesEntre(ultimaTroca, hoje) : null
    return meses ? `${nome}: ${meses} ${meses === 1 ? 'mês' : 'meses'} desde a última troca` : `${nome}: pelo tempo desde a última troca`
  }
  if (v.relogio === 'desgaste') return `${nome}: pela medição da última visita, perto do mínimo`
  return nome
}

/**
 * Ordena por urgência (crítico vencido primeiro), mostra no máximo 3 motivos e conta o resto.
 * `ultimasTrocas` dá a data da última troca por item, para o relógio de tempo dizer "N meses".
 */
export function mensagemDeLembrete(e: EntradaDaMensagem, ultimasTrocas: Partial<Record<ChaveDoItem, Temporal.PlainDate>> = {}): string {
  const peso = (v: VencimentoDoItem) => (v.estado === 'vencido' ? 0 : v.estado === 'nesta_visita' ? 1 : v.estado === 'perguntar' ? 3 : 2) * 2 - (ITENS[v.item].critico ? 1 : 0)
  const relevantes = [...e.itens].filter((v) => v.estado !== 'em_dia').sort((a, b) => peso(a) - peso(b))
  if (relevantes.length === 0) return ''
  const mostrados = relevantes.slice(0, MAXIMO_DE_ITENS_NA_MENSAGEM)
  const resto = relevantes.length - mostrados.length
  const linhas = mostrados.map((v) => `• ${motivoDoItem(v, e.kmAtual, e.hoje, ultimasTrocas[v.item] ?? null)}`)
  const algumVencido = relevantes.some((v) => v.estado === 'vencido')
  const abertura = `Oi, ${e.nomeDoCliente}! Aqui é da ${e.nomeDoNegocio}. ${algumVencido ? `Pelo plano de manutenção, ${e.veiculo} tem itens para olhar:` : `Pelo plano de manutenção, ${e.veiculo} está chegando na próxima revisão:`}`
  const maisItens = resto > 0 ? `\n• e mais ${resto} ${resto === 1 ? 'item' : 'itens'} no orçamento` : ''
  const convite = e.horarioSugerido ? `\nQuer marcar? Temos ${e.horarioSugerido} livre.` : '\nQuer marcar um horário?'
  return `${abertura}\n${linhas.join('\n')}${maisItens}${convite}`
}
