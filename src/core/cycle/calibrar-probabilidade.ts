import type { EstadoCiclo } from '@/core/cycle/compute'
import { PROBABILIDADE_POR_ESTADO } from '@/core/cycle/valor-em-risco'

/**
 * `docs/73` F1 — a metade do D+E (`docs/46`) que ficou faltando.
 *
 * `PROBABILIDADE_POR_ESTADO` (`valor-em-risco.ts`) é um palpite de lançamento, igual para todo
 * tenant, desde o primeiro commit — nunca foi medido contra o que de fato acontece. É o mesmo
 * defeito que `cycle_days` tinha antes da `0065`: um número fixo decidindo o que a tela ordena e
 * anuncia como dinheiro, sem nenhum retorno da realidade daquele salão específico.
 *
 * `cycle_predictions` já guarda o que falta para medir: cada linha resolvida sabe se a pessoa
 * voltou, e há quantos dias de atraso ela estava quando isso aconteceu (ou quando a janela de
 * espera expirou sem volta). `estadoPorAtraso` (`compute.ts`) já converte esse atraso em estado —
 * rodar a MESMA função sobre o atraso na resolução, em vez de sobre o atraso de hoje, dá a
 * pergunta certa: "de quem chegou a este estado, quantos voltaram?"
 *
 * Este arquivo não lê banco (regra 5 do `CLAUDE.md`): recebe os desfechos já resolvidos e devolve
 * a tabela calibrada. Quem lê `cycle_predictions` e monta a lista de desfechos é responsabilidade
 * de `server/services/previsao.ts`.
 */

export type DesfechoPorEstado = {
  /** O estado (`estadoPorAtraso`) no momento em que a previsão foi resolvida ou expirou sem volta. */
  estado: EstadoCiclo
  /** Voltou dentro da janela, ou não voltou (previsão expirou por `JANELA_DE_ESPERA_DIAS`). */
  voltou: boolean
}

/**
 * Mesmo piso de `MINIMO_DE_AMOSTRA` (`calibracao.ts`) e `MINIMO_PARA_AFIRMAR`
 * (`prestacao-de-contas.ts`) — abaixo disso, o percentual descreve o acaso, não o salão.
 */
export const MINIMO_POR_ESTADO = 8

/**
 * `on_track` nunca entra no cálculo, e a regra não é uma exceção rara: é definicional.
 * `on_track` é 0 porque quem está em dia não tem receita em risco — não existe "chance de
 * on_track voltar", a pergunta não faz sentido para esse estado.
 *
 * Estado sem amostra suficiente mantém `tabelaPadrao` — um salão novo, com poucos ciclos
 * resolvidos, continua usando o palpite global em vez de calibrar sobre 3 casos.
 */
export function calibrarProbabilidadePorEstado(
  desfechos: readonly DesfechoPorEstado[],
  tabelaPadrao: Record<EstadoCiclo, number> = PROBABILIDADE_POR_ESTADO,
): Record<EstadoCiclo, number> {
  const contagem = new Map<EstadoCiclo, { total: number; voltou: number }>()

  for (const d of desfechos) {
    if (d.estado === 'on_track') continue
    const atual = contagem.get(d.estado) ?? { total: 0, voltou: 0 }
    atual.total += 1
    if (d.voltou) atual.voltou += 1
    contagem.set(d.estado, atual)
  }

  const resultado = { ...tabelaPadrao }
  for (const [estado, c] of contagem) {
    if (c.total < MINIMO_POR_ESTADO) continue
    resultado[estado] = c.voltou / c.total
  }
  return resultado
}
