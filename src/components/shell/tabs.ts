export type Aba = {
  href: string
  rotulo: string
  /**
   * Nome do ícone do lucide-react, resolvido pelo `TabBar` — mantém este
   * arquivo livre de JSX/React. `'Anel'` é especial: não é lucide, é a própria
   * marca do CICLO (`docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §F1/§8) — o
   * ícone que a aba do Motor de Ciclo tinha era `Sparkles` (✨), o emblema
   * universal de "isto foi feito por IA", simbolizando exatamente o conceito
   * que justifica o produto existir. O anel aberto já É a metáfora de "cliente
   * que volta"; faz sentido a marca virar o próprio ícone aqui.
   */
  icone: 'Home' | 'CalendarDays' | 'Users' | 'Anel' | 'Plus'
}

/**
 * Os 5 slots da tab bar de `03-DESIGN-SYSTEM §4` (4 destinos + botão central).
 * Nenhum documento fixa quais 5; escolhidos os que sustentam o essencial do
 * MVP se tudo mais for cortado (`00-BRIEFING §1`): agenda, Motor de Ciclo, e o
 * cadastro de clientes que os dois dependem. Caixa e configurações ficam a um
 * toque do "Hoje", não na barra — são consultados bem menos que os cinco
 * daqui. Decisão registrada em `docs/DECISOES.md`.
 *
 * O Motor de Ciclo NÃO está nesta lista desde 31/08 porque virou o botão central
 * (`HREF_DO_CENTRO`, logo abaixo) — continua sendo um dos cinco, no slot mais alcançável.
 */
export const ABAS: readonly Aba[] = [
  { href: '/admin/hoje', rotulo: 'Hoje', icone: 'Home' },
  { href: '/admin/agenda', rotulo: 'Agenda', icone: 'CalendarDays' },
  { href: '/admin/clientes', rotulo: 'Clientes', icone: 'Users' },
  { href: '/admin/agenda/novo', rotulo: 'Marcar', icone: 'Plus' },
]

/**
 * 31/08: o centro passou a ser o Motor de Ciclo, e "marcar horário" veio para cá.
 *
 * O slot central é o único que o polegar alcança sem reposicionar a mão, e estava com a ação mais
 * COMUM do dia — não a mais valiosa. Marcar horário é o que qualquer caderno faz; o Motor de Ciclo
 * é o que justifica o produto ter preço, e vivia no canto direito, que é o lugar de onde as coisas
 * somem da rotina. Um recurso que precisa ser LEMBRADO não gera receita: receita recuperada é
 * exatamente a que ninguém buscaria sozinho.
 *
 * Nada foi removido — os dois trocaram de lugar. Marcar continua a um toque, e continua também no
 * botão da tela "Hoje" e da agenda, que são de onde o gesto costuma partir de verdade.
 */
export const HREF_DO_CENTRO = '/admin/recuperar'

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
