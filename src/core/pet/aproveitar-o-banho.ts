import { Temporal } from '@js-temporal/polyfill'

import type { ItemDoPet } from './protocolo'

/**
 * Aproveitar o banho (`docs/105-ciclo/C-010`, serviço como software).
 *
 * O tutor já vem ao pet shop no ritmo do banho (o Motor prevê esse ritmo). Item de protocolo que
 * vence perto de um banho previsto não precisa de mensagem própria: é oferecido no balcão, no dia do
 * banho. Regra: o item entra no ÚLTIMO banho entre `antecipacaoMaxDias` antes do vencimento e o próprio
 * vencimento — nunca depois (protocolo de saúde não espera o banho), e nunca adiantado mais do que a
 * janela (adiantar vermífugo uma semana é aceitável; um mês, não).
 */

export type ItemAVencerNoPet = { item: ItemDoPet; venceEm: Temporal.PlainDate }

export type ResultadoDoBanho = {
  noBanho: { item: ItemDoPet; venceEm: Temporal.PlainDate; banho: Temporal.PlainDate }[]
  aParte: ItemAVencerNoPet[]
}

export function aproveitarOBanho(banhosPrevistos: readonly Temporal.PlainDate[], aVencer: readonly ItemAVencerNoPet[], antecipacaoMaxDias = 7): ResultadoDoBanho {
  const banhos = [...banhosPrevistos].sort(Temporal.PlainDate.compare)
  const noBanho: ResultadoDoBanho['noBanho'] = []
  const aParte: ItemAVencerNoPet[] = []
  for (const v of aVencer) {
    const inicio = v.venceEm.subtract({ days: antecipacaoMaxDias })
    const candidatos = banhos.filter((b) => Temporal.PlainDate.compare(b, inicio) >= 0 && Temporal.PlainDate.compare(b, v.venceEm) <= 0)
    const banho = candidatos[candidatos.length - 1]
    if (banho) noBanho.push({ ...v, banho })
    else aParte.push(v)
  }
  return { noBanho, aParte }
}
