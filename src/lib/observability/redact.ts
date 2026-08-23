/**
 * TICKET-057. `beforeSend`/`beforeSendTransaction` do Sentry passam por aqui antes de
 * qualquer evento sair do processo — regra 9 do CLAUDE.md ("dado de saúde nunca em log,
 * Sentry ou analytics") e regra 10 ("segredo nunca no repositório") valem também para o
 * que escapa por telemetria, não só para o código-fonte.
 *
 * Duas defesas em camada, porque nenhuma das duas sozinha cobre tudo:
 * 1. chave conhecida (telefone, e-mail, cofre, token…) → apaga o valor inteiro, não importa a forma;
 * 2. texto restante → varre por padrão de telefone/e-mail/CPF, para o caso de aparecer
 *    dentro de uma mensagem de erro livre (`"cliente +5511999999999 sem horário"`), onde
 *    a chave não ajuda porque o dado está solto na frase.
 */

const CHAVES_SENSIVEIS = [
  'phone',
  'telefone',
  'email',
  'e-mail',
  'cpf',
  'password',
  'senha',
  'token',
  'authorization',
  'cookie',
  'answers',
  'respostas',
  'health',
  'saude',
  'anamnese',
  // Auditoria de segurança, achado S16. Estas cinco entraram depois das outras, e por um motivo
  // que a lista original não tinha como prever: dado de saúde neste produto **não mora só no
  // cofre**. `lib/preferencias.ts` põe um campo `alergia` em seis das sete verticais, e ele cai
  // em `clients.preferences` — jsonb, em claro, sem MFA e sem trilha. Enquanto `preferences` não
  // for uma decisão de produto resolvida, qualquer exceção que carregue um objeto de cliente
  // mandaria a alergia para o Sentry, contra a regra 9 do CLAUDE.md ("dado de saúde nunca em log,
  // Sentry ou analytics"). O mesmo vale para anotação livre: `client_notes.body` e
  // `appointments.client_note` são onde "está grávida" e "operou semana passada" acabam escritos.
  'preferenc',
  'alergia',
  'sensibilidade',
  // As duas grafias: a comparação é `includes`, e 'notes' NÃO contém 'nota' (nem o contrário).
  // Uma só cobriria a coluna em inglês (`clients.notes`, `appointments.client_note`) ou o campo
  // em português da interface, nunca os dois.
  'note',
  'nota',
  'observ',
  'ciphertext',
  'iv',
  'authtag',
  'auth_tag',
  'dek',
  'p256dh',
  'auth_key',
  'vault',
  'cofre',
  'signature',
  'assinatura',
]

/** Não é PII/segredo — fica de fora da varredura de texto para não corromper trace/span/release por coincidência de dígitos. */
const CHAVES_ISENTAS = new Set([
  'event_id',
  'trace_id',
  'span_id',
  'parent_span_id',
  'release',
  'sdk',
  'platform',
  'environment',
  'transaction',
  'level',
  'type',
  'timestamp',
  'op',
])

const MASCARA = '[redigido]'

/**
 * As bordas `(?<![\w-])` / `(?![\w-])` não estavam aqui e foram acrescentadas na auditoria de
 * 2026-08-23 (achado S20), depois que um teste do S16 mostrou o estrago: um UUID como
 * `00000000-0000-4000-8000-000000000000` tem 12 dígitos no último grupo, e o padrão de telefone
 * (10 a 15 dígitos) o engolia inteiro. Resultado: `tenant_id` e `client_id` chegavam ao Sentry
 * como `...-8000-[redigido]0`.
 *
 * Isso não é excesso de zelo inofensivo — é o contrário. Quem está de plantão usa exatamente
 * esses ids para achar o caso, e redação que apaga o identificador transforma o evento em ruído.
 * Redação boa demais é o caminho mais curto para alguém desligar a redação inteira.
 *
 * A borda resolve porque num UUID o número vem colado a um hífen; num telefone de verdade
 * (`"cliente +5511999999999 sem horário"`, `Tel:5511988887777.`) ele vem colado a espaço,
 * pontuação ou aspas.
 */
const PADRAO_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/gi
const PADRAO_CPF = /(?<![\w-])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?![\w-])/g
const PADRAO_TELEFONE = /(?<![\w-])\+?\d{10,15}(?![\w-])/g
const PROFUNDIDADE_MAXIMA = 8 // guarda contra estrutura absurda, não é limite de negócio

function chaveSensivel(chave: string): boolean {
  const k = chave.toLowerCase()
  return CHAVES_SENSIVEIS.some((s) => k.includes(s))
}

function redigirTexto(texto: string): string {
  return texto.replace(PADRAO_EMAIL, MASCARA).replace(PADRAO_CPF, MASCARA).replace(PADRAO_TELEFONE, MASCARA)
}

function redigirValor(chave: string | null, valor: unknown, profundidade: number): unknown {
  if (profundidade > PROFUNDIDADE_MAXIMA) return valor

  if (chave && chaveSensivel(chave)) return MASCARA

  if (typeof valor === 'string') {
    return chave && CHAVES_ISENTAS.has(chave) ? valor : redigirTexto(valor)
  }

  if (Array.isArray(valor)) return valor.map((item) => redigirValor(null, item, profundidade + 1))

  if (valor && typeof valor === 'object') {
    const saida: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(valor)) saida[k] = redigirValor(k, v, profundidade + 1)
    return saida
  }

  return valor
}

/** Devolve uma cópia do evento com todo dado sensível redigido — nunca muta o original. */
export function redigirEventoSentry<T extends object>(evento: T): T {
  return redigirValor(null, evento, 0) as T
}
