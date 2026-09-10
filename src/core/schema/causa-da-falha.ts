/**
 * Por que a tela quebrou, quando dá para saber — e por que o boundary não sabia sozinho.
 *
 * `src/app/admin/error.tsx` dizia sempre a mesma frase: *"Pode ter sido a conexão."* Em
 * 2026-09-10 o Eduardo caiu nela com a conexão perfeita: o banco apontado pelo `.env.local`
 * estava com o schema **parcialmente aplicado** (a view `v_clientes_a_recuperar` da `0058` não
 * existia), e `centralDeAcoes` morria com `PGRST205` ao montar a tela Hoje. A mensagem mandou
 * procurar o problema no lugar errado.
 *
 * Isso não é só desconforto de quem desenvolve. É **exatamente** o incidente de 2026-09-04
 * (`docs/62`): código no ar dependendo de coluna que a produção não tinha. Naquele dia quem levou
 * o erro foi a cliente final, e a tela dela também teria dito "pode ter sido a conexão".
 *
 * ## Por que a resposta não vem do objeto de erro
 *
 * O boundary é `'use client'` e recebe `error: Error & { digest?: string }`. Em produção o Next
 * **higieniza** a mensagem de erro de Server Component: sobra o `digest`, não a causa. Perguntar
 * ao objeto de erro nunca ia funcionar onde importa.
 *
 * Quem já sabe é `/api/health`, que roda `compararSchema` (`core/schema/versao.ts`) contra o livro
 * de migrations. O boundary pergunta a ele. Esta função é a parte pura dessa decisão: recebe o
 * corpo da resposta e devolve a causa. Sem I/O, testável de verdade no ambiente `node` da suíte.
 */

export type CausaDaFalha =
  /** O aplicativo está mais novo que o banco. Faltam migrations. */
  | 'schema_defasado'
  /** O banco não respondeu. Aí "pode ter sido a conexão" é verdade. */
  | 'banco_fora'
  /** Não deu para saber. Mantém a mensagem genérica, que não promete nada. */
  | 'desconhecida'

/**
 * Lê o corpo de `/api/health` com a mesma desconfiança de `lerAssinatura`: é JSON de fora, nada
 * garantido. Só afirma o que consegue provar; qualquer forma inesperada vira `desconhecida`.
 *
 * Ordem importa: schema defasado vem ANTES de banco fora. Um banco atrás do código costuma
 * derrubar outras checagens junto, e a causa acionável é a que o dono do sistema pode consertar.
 */
export function causaDaFalhaDaTela(corpoDoHealth: unknown): CausaDaFalha {
  if (!corpoDoHealth || typeof corpoDoHealth !== 'object') return 'desconhecida'
  const checks = (corpoDoHealth as Record<string, unknown>).checks
  if (!checks || typeof checks !== 'object') return 'desconhecida'

  const ler = (nome: string): boolean | null => {
    const c = (checks as Record<string, unknown>)[nome]
    if (!c || typeof c !== 'object') return null
    const ok = (c as Record<string, unknown>).ok
    return typeof ok === 'boolean' ? ok : null
  }

  if (ler('schema') === false) return 'schema_defasado'
  if (ler('database') === false) return 'banco_fora'
  return 'desconhecida'
}

/**
 * O detalhe técnico que a própria rota de saúde escreveu, quando existe.
 *
 * Vai numa linha discreta, embaixo da frase em português: quem cuida do salão ignora, quem cuida
 * do sistema lê ali "faltam N migrations, aplicar com db push" sem abrir o painel. A frase de cima
 * nunca depende deste texto.
 */
export function detalheTecnicoDaFalha(corpoDoHealth: unknown, causa: CausaDaFalha): string | null {
  if (causa === 'desconhecida') return null
  const checks = (corpoDoHealth as { checks?: Record<string, unknown> } | null)?.checks
  const alvo = causa === 'schema_defasado' ? 'schema' : 'database'
  const c = checks?.[alvo]
  if (!c || typeof c !== 'object') return null
  const detail = (c as Record<string, unknown>).detail
  return typeof detail === 'string' && detail.length > 0 ? detail : null
}

/**
 * A frase que a pessoa lê. Fica aqui, e não no componente, para a guarda conseguir afirmar sobre
 * ela sem varrer JSX (a armadilha de casar com o próprio comentário, do `CLAUDE.md`).
 *
 * Sem travessão de propósito: `copy-sem-travessao` varre a copy renderizada.
 */
export const FRASE_DA_CAUSA: Record<CausaDaFalha, string> = {
  schema_defasado:
    'O sistema foi atualizado e o banco de dados ainda não. Não é a sua internet, e nada do que você salvou foi perdido.',
  banco_fora: 'Não consegui falar com o banco de dados agora. Nada do que você salvou foi perdido.',
  desconhecida: 'Pode ter sido a conexão. Nada do que você salvou foi perdido.',
}
