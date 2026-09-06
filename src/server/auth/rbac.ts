import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'

export type Papel = Database['public']['Enums']['user_role']

/**
 * Tabela de `01-ESPEC-TECNICA §3.3`, literal. A checagem de permissão é a
 * primeira das duas camadas: a segunda é a política de RLS no banco. Se só uma
 * existir, está errado.
 */
export const PERMISSIONS = {
  owner: ['*'],
  manager: [
    'appointment:*',
    'client:*',
    'service:*',
    'inventory:*',
    'report:read',
    'professional:read',
  ],
  professional: ['appointment:own', 'client:own', 'vault:own', 'comanda:own'],
  reception: ['appointment:*', 'client:read', 'client:create', 'comanda:create'],
  finance: ['payment:*', 'commission:*', 'report:*'],
} as const satisfies Record<Papel, readonly string[]>

/**
 * `all` = pode agir sobre qualquer registro do tenant. `own` = só sobre os
 * próprios — é o que `appointment:own` da tabela significa: `own` não é um verbo,
 * é o alcance. Quem recebe `own` ainda precisa filtrar pelo próprio profissional
 * na consulta; a RLS (`can_see_appointment`) é a rede embaixo.
 */
export type Escopo = 'all' | 'own'

/**
 * `report:team` — quem o lucro do salão DEPENDE, nome por nome.
 *
 * `docs/50` L-10 manda decidir e registrar se o `manager` alcança a concentração por profissional,
 * e a decisão está em `docs/DECISOES.md` (2026-09-06): **não**. Ela é a informação mais delicada
 * do conjunto dentro de uma equipe — *"62% do lucro veio do Rafa"* muda a conversa de comissão, de
 * escala e de cadeira, e o `manager` costuma ser colega de quem a frase nomeia. `owner` alcança
 * pelo curinga, `finance` pelo `report:*` que já tem; `manager` tem `report:read` literal e por
 * isso NÃO alcança — a tabela de `PERMISSIONS` já produzia esse resultado, faltava alguém pedir.
 *
 * **Isto não é uma trava de segurança, e dizer o contrário seria pior que não ter.** O `manager`
 * lê `tickets` e `ticket_items` pela RLS, legitimamente, e com isso monta a mesma conta à mão. A
 * camada aqui é de apresentação: o produto para de PUBLICAR o ranking para quem convive com ele.
 * A trava de duas camadas do `CLAUDE.md` vale para tabela nova; esta é uma leitura derivada de
 * dado que o papel já alcança por outro motivo legítimo, e restringir `tickets` para `manager`
 * quebraria o caixa inteiro.
 */
export const RELATORIO_DA_EQUIPE = 'report:team' as const

/**
 * Ações que a FAQ reserva ao dono, e que o curinga da tabela acima entregaria a
 * mais. `client:export` cai aqui por causa da C35 ("só owner, com MFA na hora,
 * no máximo 1×/mês"), que contradiz o `client:*` do manager em §3.3. Entre as
 * duas leituras, vale a restritiva: exportar a base é a carteira inteira saindo
 * pela porta, e o erro de negar demais se conserta com um clique do dono.
 */
const EXCLUSIVAS_DO_DONO = new Set(['client:export'])

/** Devolve o alcance concedido, ou `null` quando o papel não tem a permissão. */
export function avaliarPermissao(papel: Papel, requerida: `${string}:${string}`): Escopo | null {
  if (papel !== 'owner' && EXCLUSIVAS_DO_DONO.has(requerida)) return null

  const concedidas: readonly string[] = PERMISSIONS[papel]
  if (concedidas.includes('*')) return 'all'

  const [recurso] = requerida.split(':')
  if (concedidas.includes(`${recurso}:*`) || concedidas.includes(requerida)) return 'all'
  if (concedidas.includes(`${recurso}:own`)) return 'own'

  return null
}

/** Guard de handler: `403 FORBIDDEN` quando o papel não alcança a ação. */
export function exigirPermissao(papel: Papel, requerida: `${string}:${string}`): Escopo {
  const escopo = avaliarPermissao(papel, requerida)
  if (!escopo) throw new AppError('FORBIDDEN')
  return escopo
}
