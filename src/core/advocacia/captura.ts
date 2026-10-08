import { corpoDaRpc, type Alvo, type DiaCapturado } from './intimacoes'
import { diasNaoContaveis, sugerirPrazo, type FeriadoCadastrado } from './prazo-sugestao'

import type { Rito } from './prazo-calculo'

/**
 * docs/101 T4.1: o corpo da gravação de UM alvo num dia, com a sugestão de prazo de cada item. Pura.
 *
 * O rito, o "em dobro" e a comarca vêm do CASO que tem o mesmo número de processo (nunca inferidos do
 * texto). Sem caso, ou sem regra confirmada pela direção, não há data: a sugestão leva o motivo, e a
 * triagem pede a data à pessoa.
 */

export type CasoParaCaptura = { rito: Rito | null; emDobro: boolean; comarca: string | null }

type Sugestao =
  | { suggested_due_on: string; internal_due_on: string; calc_memo: Record<string, unknown>; calc_rule_version: string }
  | { sem_sugestao: string }

export function corpoComSugestoes(
  alvo: Alvo,
  dia: string,
  capturado: DiaCapturado,
  casosPorNumero: ReadonlyMap<string, CasoParaCaptura>,
  feriados: readonly FeriadoCadastrado[],
  confirmadas: readonly string[],
) {
  const corpo = corpoDaRpc(alvo, dia, capturado)
  return {
    ...corpo,
    itens: corpo.itens.map((item, i) => {
      const c = capturado.comunicacoes[i]!
      const caso = casosPorNumero.get(c.numeroProcesso)
      let sugestao: Sugestao
      if (!caso) {
        sugestao = { sem_sugestao: 'Processo sem caso no escritório: vincule a um caso para a contagem considerar o rito.' }
      } else {
        const s = sugerirPrazo({
          texto: c.texto,
          disponibilizadoEm: c.dataDisponibilizacao,
          rito: caso.rito,
          emDobro: caso.emDobro,
          naoContaveis: diasNaoContaveis(feriados, c.tribunal, caso.comarca),
          tipoDaComunicacao: c.tipo,
          confirmadas,
        })
        sugestao =
          s.sugerida === null
            ? { sem_sugestao: s.motivo.slice(0, 300) }
            : { suggested_due_on: s.sugerida, internal_due_on: s.interno, calc_memo: s.memo, calc_rule_version: s.versao }
      }
      return { ...item, sugestao }
    }),
  }
}
