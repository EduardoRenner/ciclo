/**
 * APR-103 (docs/98 I-06, A-21): o menu do topo obedece à MESMA regra do hub de Configurações. Antes
 * era uma lista fixa: com "Estoque" desligado pelo dono, o menu ainda levava para `/admin/estoque`; e a
 * Recepção via "Caixa", tocava, e a tela respondia que aquilo não era para ela.
 *
 * Função pura: quem diz se o módulo aparece (`moduloVisivel`, a regra do hub) e se o papel alcança a
 * permissão (`avaliarPermissao`, `server/auth/rbac.ts`) é injetado. O core não importa do servidor.
 */
import type { ModuloKey } from '@/core/billing/planos'

export type AtalhoDoMenu = {
  href: string
  titulo: string
  /** Módulo que a tela de destino exige (o mesmo do item no hub de Configurações). */
  modulo?: ModuloKey
  /** Permissão sem a qual a tela de destino recusa a pessoa. */
  permissao?: `${string}:${string}`
}

/**
 * Curadoria do que fica FORA da barra inferior e é usado com frequência (docs/61 §4); "Configurações"
 * por último. Módulo e permissão copiam o que cada tela de destino confere.
 */
export const ATALHOS_DO_MENU: readonly AtalhoDoMenu[] = [
  { href: '/admin/caixa', titulo: 'Caixa', modulo: 'register', permissao: 'report:read' },
  { href: '/admin/config/servicos', titulo: 'Serviços' },
  { href: '/admin/config/profissionais', titulo: 'Time' },
  { href: '/admin/campanhas', titulo: 'Campanhas', modulo: 'campaigns' },
  { href: '/admin/estoque', titulo: 'Estoque', modulo: 'stock', permissao: 'inventory:read' },
  { href: '/admin/series', titulo: 'Recorrência', modulo: 'recurrence' },
  { href: '/admin/config', titulo: 'Configurações' },
]

export function atalhosVisiveis(regras: { moduloVisivel: (m: ModuloKey) => boolean; alcanca: (p: `${string}:${string}`) => boolean }): AtalhoDoMenu[] {
  return ATALHOS_DO_MENU.filter((a) => (!a.modulo || regras.moduloVisivel(a.modulo)) && (!a.permissao || regras.alcanca(a.permissao)))
}
