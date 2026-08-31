import { ABAS } from './tabs'

export type Pai = { href: string; rotulo: string }

/**
 * De onde a pessoa veio, e para onde o "voltar" leva.
 *
 * Isto existe por um motivo concreto: `manifest.json` declara
 * `display: "standalone"`, ou seja, instalado o app **não tem** a barra do
 * navegador — logo não tem botão de voltar. Só três telas do projeto tinham um
 * `ArrowLeft` próprio; as nove de `/admin/config/*`, mais comanda, campanhas e
 * `agenda/novo`, eram becos sem saída em aparelho instalado.
 *
 * Um mapa explícito, e não `router.back()`: histórico depende de como a pessoa
 * chegou (link do WhatsApp, atalho da tela de início, recarregar), e um voltar
 * que às vezes sai do app é pior que nenhum. Além disso o rótulo do destino
 * ("Voltar para Clientes") só existe se souber para onde vai.
 */
const REGRAS: { prefixo: string; pai: Pai }[] = [
  // Mais específico primeiro — `/admin/config/servicos` tem que casar antes de `/admin/config`.
  { prefixo: '/admin/config/', pai: { href: '/admin/config', rotulo: 'Configurações' } },
  { prefixo: '/admin/config', pai: { href: '/admin/hoje', rotulo: 'Hoje' } },
  { prefixo: '/admin/campanhas/', pai: { href: '/admin/campanhas', rotulo: 'Campanhas' } },
  { prefixo: '/admin/campanhas', pai: { href: '/admin/config', rotulo: 'Configurações' } },
  // Mesmo padrão de Campanhas: `/orcamentos/novo` volta para a lista, a lista volta para
  // Configurações (só chegou nela pelo atalho do engenhoso — não é sub-rota de nenhuma aba,
  // então sem regra explícita virava beco sem saída num app instalado sem barra do navegador).
  { prefixo: '/admin/orcamentos/', pai: { href: '/admin/orcamentos', rotulo: 'Orçamentos' } },
  { prefixo: '/admin/orcamentos', pai: { href: '/admin/config', rotulo: 'Configurações' } },
  { prefixo: '/admin/series', pai: { href: '/admin/config', rotulo: 'Configurações' } },
  // A comanda abre a partir do atendimento do dia, nunca de um menu.
  { prefixo: '/admin/comanda', pai: { href: '/admin/agenda', rotulo: 'Agenda' } },
  // O caixa se chega pelo número de "Faturado hoje" — o voltar tem que devolver para lá.
  { prefixo: '/admin/caixa', pai: { href: '/admin/hoje', rotulo: 'Hoje' } },
  // O estoque se chega pelo alerta de recompra de "Hoje", pelo mesmo motivo.
  { prefixo: '/admin/estoque', pai: { href: '/admin/hoje', rotulo: 'Hoje' } },
]

/**
 * `null` quando a rota é a raiz de uma aba — lá o "voltar" seria uma mentira: a
 * tab bar já é a navegação, e sair de "Hoje" para trás significaria sair do app.
 *
 * 31/08: "estar na lista de abas" deixou de ser o mesmo que "ser raiz". Com o Motor de Ciclo indo
 * para o botão central, "Marcar" (`/admin/agenda/novo`) entrou na barra — e ela é um FORMULÁRIO
 * aninhado sob a Agenda, não um destino de topo. Sem esta distinção o formulário perdia o voltar
 * para quem chega pelo botão da agenda, que é o caminho mais comum: a barra continuaria ali, mas
 * "voltar para a agenda" e "trocar de aba" não são o mesmo gesto nem levam ao mesmo lugar na
 * cabeça de quem usa.
 *
 * A regra passa a ser topológica em vez de baseada na lista: uma aba cujo href é sub-rota de OUTRA
 * aba é um formulário, e mantém o voltar do pai.
 */
export function paiDaRota(pathname: string): Pai | null {
  const ehRaizDeAba = ABAS.some(
    (aba) => aba.href === pathname && !ABAS.some((outra) => outra.href !== aba.href && aba.href.startsWith(`${outra.href}/`)),
  )
  if (ehRaizDeAba) return null

  const regra = REGRAS.find((r) => pathname.startsWith(r.prefixo))
  if (regra) return regra.pai

  // Sub-rota de uma aba (`/admin/clientes/123`, `/admin/agenda/novo`) volta para a própria aba.
  const aba = ABAS.find((a) => pathname.startsWith(`${a.href}/`))
  return aba ? { href: aba.href, rotulo: aba.rotulo } : null
}
