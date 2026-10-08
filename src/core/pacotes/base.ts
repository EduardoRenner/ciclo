import type { Pacote } from './tipos'

/**
 * O pacote `base`: o CICLO como ele é hoje, para toda profissão que não tem pacote próprio.
 *
 * Os valores abaixo vieram de `components/shell/tabs.ts` sem mudar uma letra, e o teste
 * `tests/unit/core/pacotes.test.ts` fixa cada um por literal (não por referência), para que
 * nenhuma refatoração futura mude a barra de quem já usa o produto sem que alguém veja.
 *
 * Os 5 slots da tab bar de `03-DESIGN-SYSTEM §4` (4 destinos + botão central). Nenhum documento
 * fixa quais 5; escolhidos os que sustentam o essencial do MVP se tudo mais for cortado
 * (`00-BRIEFING §1`): agenda, Motor de Ciclo, e o cadastro de clientes que os dois dependem.
 * Caixa e configurações ficam a um toque do "Hoje", não na barra. Decisão em `docs/DECISOES.md`.
 *
 * 31/08: o centro passou a ser o Motor de Ciclo, e "marcar horário" veio para a barra. O slot
 * central é o único que o polegar alcança sem reposicionar a mão, e estava com a ação mais COMUM
 * do dia, não a mais valiosa. Marcar horário é o que qualquer caderno faz; o Motor de Ciclo é o
 * que justifica o produto ter preço. Nada foi removido: os dois trocaram de lugar.
 */
export const BASE: Pacote = {
  slug: 'base',
  nome: 'Padrão',
  abas: [
    { href: '/admin/hoje', rotulo: 'Hoje', icone: 'Home' },
    { href: '/admin/agenda', rotulo: 'Agenda', icone: 'CalendarDays' },
    { href: '/admin/clientes', rotulo: 'Clientes', icone: 'Users' },
    { href: '/admin/agenda/novo', rotulo: 'Marcar', icone: 'Plus' },
  ],
  centro: { href: '/admin/recuperar', rotulo: 'Recuperar receita', icone: 'Anel' },
  vocabularioExtra: {},
  exigeSegundoFator: false,
}
