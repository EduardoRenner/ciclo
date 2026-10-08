import type { Pacote } from './tipos'

/**
 * O pacote Advocacia (docs/101-MVP-ADVOGADO.md §7 e anexo 04 §3).
 *
 * Barra: Hoje · Casos · [Pendências] · Agenda · Clientes. "Casos" entra no lugar de "Marcar";
 * marcar reunião continua a um toque em Agenda e em Hoje. O centro é **Pendências** (o que falta
 * de cada cliente), que é o diferencial do pacote, pelo mesmo motivo que o centro da `base` é o
 * Motor de Ciclo: o slot mais alcançável fica com a ação mais valiosa, não com a mais comum.
 *
 * As rotas `/admin/casos` e `/admin/pendencias` nascem no T0.3. Até lá este pacote só é
 * alcançado por tenant com a profissão `advocacia`, que nenhuma conta de produção consegue
 * escolher enquanto `ADVOCACIA_ABERTA` (T0.6) estiver desligada.
 *
 * Vocabulário extra: as palavras que as seis chaves de `PADRAO` não têm. Rótulos de papel sem
 * gênero (guarda `copy-nao-supoe-genero`): "direção" em vez de "sócio", "advocacia" em vez de
 * "advogado", "estágio" em vez de "estagiário".
 */
export const ADVOCACIA: Pacote = {
  slug: 'advocacia',
  nome: 'Advocacia',
  abas: [
    { href: '/admin/hoje', rotulo: 'Hoje', icone: 'Home' },
    { href: '/admin/casos', rotulo: 'Casos', icone: 'Briefcase' },
    { href: '/admin/agenda', rotulo: 'Agenda', icone: 'CalendarDays' },
    { href: '/admin/clientes', rotulo: 'Clientes', icone: 'Users' },
  ],
  centro: { href: '/admin/pendencias', rotulo: 'Pendências', icone: 'ListChecks' },
  vocabularioExtra: {
    caso: 'caso',
    prazo: 'prazo',
    pendencia: 'pendência',
    intimacao: 'intimação',
    direcao: 'direção',
    advocacia: 'advocacia',
    secretaria: 'secretaria',
    estagio: 'estágio',
  },
  // Sigilo profissional: ninguém do escritório trabalha só com senha (docs/101 §6.3).
  exigeSegundoFator: true,
}
