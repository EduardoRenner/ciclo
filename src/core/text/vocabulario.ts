/**
 * O vocabulário da profissão: o produto falando a língua de quem o usa.
 *
 * As 17 profissões guardam um `vocab` em `professions.vocab` desde a migration 0022, e o dono pode
 * sobrescrever em `tenants.vocab_override`. As duas colunas existiam com **zero consumidores**: o
 * produto perguntava a profissão no cadastro, guardava o vocabulário dela e nunca aplicava. Um
 * psicólogo lia "Serviço" onde o certo é "Sessão"; um personal lia "Cliente" onde o certo é
 * "Aluno". Mesma classe de `tenants.cobranca`, que originou o `docs/40`.
 *
 * Precedência, decidida em `docs/DECISOES.md` (2026-09-04) e igual à área de *Terminology* do Jane
 * App: **override do dono → pacote da profissão → padrão da casa**, chave a chave. Valor ausente,
 * vazio ou só espaço cai para o degrau seguinte — meia customização não pode deixar um rótulo em
 * branco na tela.
 *
 * `core/` porque é regra de apresentação pura, sem I/O (regra 5 do `CLAUDE.md`).
 */

/** As palavras que o produto troca. Tudo fora desta lista continua fixo. */
export const PADRAO = {
  cliente: 'cliente',
  atendimento: 'atendimento',
  profissional: 'profissional',
  servico: 'serviço',
  agenda: 'agenda',
  local: 'local',
} as const

export type ChaveDeVocabulario = keyof typeof PADRAO
export type Vocabulario = Record<ChaveDeVocabulario, string>

const CHAVES = Object.keys(PADRAO) as ChaveDeVocabulario[]

function limpo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim()
  return t.length > 0 ? t : null
}

/**
 * Resolve as palavras finais. `pacote` é `professions.vocab`, `override` é `tenants.vocab_override`
 * — os dois vêm do banco como `jsonb`, então chegam aqui como `unknown` e são validados chave a
 * chave. Um `jsonb` com lixo dentro não pode derrubar a página do salão.
 */
export function resolverVocabulario(pacote: unknown, override: unknown): Vocabulario {
  const p = (pacote ?? {}) as Record<string, unknown>
  const o = (override ?? {}) as Record<string, unknown>
  const saida = {} as Vocabulario
  for (const chave of CHAVES) saida[chave] = limpo(o[chave]) ?? limpo(p[chave]) ?? PADRAO[chave]
  return saida
}

/**
 * Plural do vocabulário, para o título "Serviços" da vitrine.
 *
 * **Não é um pluralizador de português**, e não pode virar um: `-l`, `-r`, `-m` e `-z` têm regras
 * próprias e um pluralizador genérico erraria calado. Aqui o conjunto é FECHADO — são as palavras
 * que as 17 profissões guardam — e a guarda `vocabulario-tem-plural` confere que toda palavra do
 * seed cai numa das duas regras abaixo. Palavra nova que não caia reprova o build, que é onde
 * alguém olha.
 *
 * As duas regras cobrem tudo que existe hoje: `sessão` vira `sessões` (a única irregular), e o
 * resto ganha `s` (serviço, treino, aula, faxina, ensaio, trabalho, atendimento).
 */
export function plural(palavra: string): string {
  if (palavra.endsWith('ão')) return `${palavra.slice(0, -2)}ões`
  return `${palavra}s`
}

/** `true` quando `plural()` sabe tratar a palavra. A guarda do seed usa isto. */
export function temPluralConhecido(palavra: string): boolean {
  return palavra.endsWith('ão') || /[aeiouçãéíóú]$/i.test(palavra)
}

/**
 * Primeira letra maiúscula, para o vocabulário virar rótulo de tela.
 *
 * O vocabulário é guardado em minúscula porque é assim que ele aparece no meio de uma frase
 * ("endereço do atendimento"). Quem precisa dele como título aplica isto. `toUpperCase` na letra,
 * e não `text-transform` no CSS: o `uppercase` do título já existe e cuida da aparência, mas o
 * texto tem que estar certo também para leitor de tela e para quando o rótulo aparece sem a classe.
 */
export function comMaiuscula(palavra: string): string {
  return palavra.length > 0 ? palavra[0]!.toUpperCase() + palavra.slice(1) : palavra
}
