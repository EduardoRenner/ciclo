import { PACOTES } from '@/core/pacotes'

import type { Aba } from '@/core/pacotes'

export type { Aba }

/**
 * A barra do pacote `base` (docs/101 T0.1): os valores moram em `core/pacotes/base.ts`, com a
 * história de cada escolha (os 5 slots de `03-DESIGN-SYSTEM §4`; o Motor de Ciclo no centro desde
 * 31/08). Estes dois nomes continuam exportados porque `tab-bar.tsx` e `tests/unit/shell/tabs.test.ts`
 * os consomem e porque, para toda profissão sem pacote próprio, eles ainda são a barra inteira.
 *
 * Quem precisa da barra de OUTRO pacote não lê daqui: lê `PACOTES[pacote].abas`, com o `pacote`
 * que `contextoAtual` resolve do tenant.
 */
export const ABAS: readonly Aba[] = PACOTES.base.abas

export const HREF_DO_CENTRO = PACOTES.base.centro.href

/**
 * Uma aba fica ativa também nas rotas abaixo dela (`/clientes/123`), exceto
 * `/hoje`: sem esse caso especial, `/hoje` casaria com prefixo vazio e
 * acenderia sempre. É por isso que essa regra não é só `pathname.startsWith`.
 */
export function abaAtiva(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Qual aba acende, quando mais de uma casa.
 *
 * Passou a ser necessário com "Marcar" (`/admin/agenda/novo`) na barra: essa rota casa com a aba
 * Agenda por prefixo E com a própria Marcar por igualdade, e as duas acenderiam ao mesmo tempo —
 * dizendo à pessoa que ela está em dois lugares. Vence a mais específica, que é a mais longa.
 */
export function hrefDaAbaAtiva(pathname: string, abas: readonly Aba[] = ABAS): string | null {
  let escolhida: string | null = null
  for (const aba of abas) {
    if (!abaAtiva(pathname, aba.href)) continue
    if (escolhida === null || aba.href.length > escolhida.length) escolhida = aba.href
  }
  return escolhida
}
