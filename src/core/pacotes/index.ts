import { ADVOCACIA } from './advocacia'
import { BASE } from './base'
import type { Pacote, SlugDoPacote } from './tipos'

export type { Aba, IconeDaAba, Pacote, SlugDoPacote } from './tipos'

/**
 * O registro: um pacote por valor do `check` de `professions.pacote` (migration 0102).
 *
 * As duas listas, a do banco e esta, precisam bater, e `tests/unit/design/pacote-tem-registro.test.ts`
 * é quem confere: valor na migration sem entrada aqui quebraria a barra de um tenant inteiro em
 * silêncio (cairia no `base` pela normalização abaixo e ninguém saberia); entrada aqui sem valor na
 * migration é pacote que nenhuma profissão alcança.
 */
export const PACOTES: Readonly<Record<SlugDoPacote, Pacote>> = {
  base: BASE,
  advocacia: ADVOCACIA,
}

/**
 * O que veio do banco (`professions.pacote`, via join) vira um slug conhecido. Ausente, nulo ou
 * desconhecido cai em `base`: é o lado seguro de errar, porque `base` é o produto de hoje. Tenant
 * sem profissão escolhida (join nulo) é o caso normal das contas antigas, não um defeito.
 *
 * Pura e sem log de propósito (regra 5 do `CLAUDE.md`); quem quiser avisar sobre valor
 * desconhecido faz isso em `server/`, como `normalizarPlano` faz com o plano.
 */
export function normalizarPacote(valor: unknown): SlugDoPacote {
  return typeof valor === 'string' && valor in PACOTES ? (valor as SlugDoPacote) : 'base'
}

/** O pacote resolvido de um valor cru do banco: `PACOTES[normalizarPacote(valor)]`. */
export function pacoteDe(valor: unknown): Pacote {
  return PACOTES[normalizarPacote(valor)]
}
