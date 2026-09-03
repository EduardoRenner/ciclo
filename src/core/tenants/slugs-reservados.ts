/**
 * Os endereços que `[slug]` NÃO pode receber, e por que a lista precisa estar completa.
 *
 * Toda pasta real de `src/app/` — inclusive as que moram dentro de um grupo de rota e não viram
 * segmento próprio, como `(auth)/entrar` e `(public)/precos` — ganha de `[slug]` no roteamento do
 * Next. Um salão que escolhesse um desses nomes ficaria **inacessível para sempre, sem erro nenhum
 * avisando**: `/{slug}` passaria a servir a página estática do produto, e a página pública dele
 * simplesmente nunca carregaria.
 *
 * **A lista estava incompleta, e foi medido em 2026-09-03.** Faltavam SEIS segmentos que existem
 * como pasta: `avaliar`, `orcamento`, `precos`, `privacidade`, `recuperar-senha` e `termos`. O
 * defeito era exatamente o que o comentário original descrevia e a lista existia para impedir — o
 * texto estava certo e a lista não acompanhou as rotas que nasceram depois dele.
 *
 * Por isso ela saiu de `server/auth/schemas.ts` e veio para `core/`: agora tem **dois leitores** —
 * a validação do onboarding e o boundary de erro da raiz, que precisa saber se o primeiro segmento
 * do caminho é um salão ou uma página do produto para não mandar a pessoa de volta para a tela que
 * acabou de falhar. Regra 5 do `CLAUDE.md`: regra de negócio pura, sem I/O.
 *
 * `tests/unit/core/slugs-reservados-cobrem-as-rotas.test.ts` compara esta lista com as pastas de
 * verdade. Rota nova nasce reprovando até entrar aqui — que é a única forma de a lista não voltar a
 * envelhecer sozinha.
 */
export const SLUGS_RESERVADOS: ReadonlySet<string> = new Set([
  // Pastas que existem hoje em `src/app/`.
  'admin',
  'api',
  'auth',
  'avaliar',
  'cadastro',
  'confirmar',
  'dev',
  'entrar',
  'lista-espera',
  'nova-senha',
  'onboarding',
  'orcamento',
  'precos',
  'privacidade',
  'recuperar-senha',
  'termos',
  'verificar',
  // Rotas planejadas, sem pasta ainda. Ficam reservadas de véspera de propósito: um salão que
  // pegasse o nome antes da rota nascer perderia a página no dia do deploy.
  'convite',
  'minha-conta',
])

/**
 * O primeiro segmento deste caminho é uma página do PRODUTO, e não um salão?
 *
 * Usada pelo boundary de erro para escolher a saída. Sem isto, um erro em `/precos` oferecia
 * "Voltar para a página do estabelecimento" apontando para `/precos` — o rótulo errado, e um botão
 * que devolve a pessoa exatamente para a tela que acabou de quebrar.
 */
export function ehRotaDoProduto(primeiroSegmento: string): boolean {
  return SLUGS_RESERVADOS.has(primeiroSegmento.trim().toLowerCase())
}
