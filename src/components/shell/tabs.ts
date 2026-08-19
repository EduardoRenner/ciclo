export type Aba = {
  href: string
  rotulo: string
  /** Nome do ícone do lucide-react, resolvido pelo `TabBar` — mantém este arquivo livre de JSX/React. */
  icone: 'Home' | 'CalendarDays' | 'Users' | 'Sparkles'
}

/**
 * Os 5 slots da tab bar de `03-DESIGN-SYSTEM §4` (4 destinos + FAB central).
 * Nenhum documento fixa quais 5; escolhidos os que sustentam o essencial do
 * MVP se tudo mais for cortado (`00-BRIEFING §1`): agenda, Motor de Ciclo, e o
 * cadastro de clientes que os dois dependem. Caixa e configurações ficam a um
 * toque do "Hoje", não na barra — são consultados bem menos que os quatro
 * daqui. Decisão registrada em `docs/DECISOES.md`.
 */
export const ABAS: readonly Aba[] = [
  { href: '/admin/hoje', rotulo: 'Hoje', icone: 'Home' },
  { href: '/admin/agenda', rotulo: 'Agenda', icone: 'CalendarDays' },
  { href: '/admin/clientes', rotulo: 'Clientes', icone: 'Users' },
  { href: '/admin/recuperar', rotulo: 'Recuperar', icone: 'Sparkles' },
]

/**
 * Uma aba fica ativa também nas rotas abaixo dela (`/clientes/123`), exceto
 * `/hoje`: sem esse caso especial, `/hoje` casaria com prefixo vazio e
 * acenderia sempre. É por isso que essa regra não é só `pathname.startsWith`.
 */
export function abaAtiva(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
