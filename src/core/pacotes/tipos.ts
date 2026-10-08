/**
 * Os tipos do pacote por profissão (docs/101-MVP-ADVOGADO.md §3.2).
 *
 * Um pacote é o que muda de uma profissão para outra na casca do app: as abas da barra, o
 * botão central e as palavras que o vocabulário das seis chaves (`core/text/vocabulario.ts`)
 * não cobre. O que NÃO muda (conta, equipe, clientes, agenda, cofre, auditoria, jobs) é o
 * núcleo, e não aparece aqui.
 *
 * Moram em `core/` porque são dado e regra pura, e porque `core/` não pode importar de
 * `@/components` (guarda `core-nao-conhece-o-mundo`): o `Aba` que vivia em
 * `components/shell/tabs.ts` veio para cá, e `tabs.ts` passou a consumir daqui.
 */

/**
 * Nome do ícone do lucide-react, resolvido pelo `TabBar`, que é quem conhece React. `'Anel'` é
 * especial: não é lucide, é a própria marca do CICLO (`docs/08-REDESIGN-E-IDENTIDADE.md` Parte
 * II §F1/§8). A união é fechada de propósito: o `TabBar` mantém um `Record` exaustivo sobre ela,
 * então ícone novo aqui sem desenho lá não compila.
 */
export type IconeDaAba = 'Home' | 'CalendarDays' | 'Users' | 'Anel' | 'Plus' | 'Briefcase' | 'ListChecks'

export type Aba = {
  href: string
  rotulo: string
  icone: IconeDaAba
}

/** Os valores do `check` de `professions.pacote` (migration 0101). A guarda `pacote-tem-registro` confere. */
export type SlugDoPacote = 'base' | 'advocacia'

export type Pacote = {
  slug: SlugDoPacote
  /** Como o pacote se apresenta em Configurações ("Pacote: Advocacia"). */
  nome: string
  /** Os quatro destinos da barra, na ordem. O quinto slot é o `centro`. */
  abas: readonly Aba[]
  /** O botão central: o slot que o polegar alcança sem reposicionar a mão (`tabs.ts`, 31/08). */
  centro: { href: string; rotulo: string; icone: IconeDaAba }
  /**
   * Palavras do pacote que não estão nas seis chaves do vocabulário da profissão. Chave em
   * minúscula, sem acento, como as de `PADRAO`; valor em minúscula, sem gênero presumido.
   */
  vocabularioExtra: Readonly<Record<string, string>>
  /**
   * O painel inteiro exige segundo fator (docs/101 §6.3, T0.4). `true` só onde o dado justifica a
   * fricção: sigilo profissional no escritório. Beleza continua como sempre, com segundo fator só
   * nas ações sensíveis (`exigirAal2`, `session.ts`).
   */
  exigeSegundoFator: boolean
}
