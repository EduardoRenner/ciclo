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
const PADRAO_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/gi
const PADRAO_CPF = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g
const PADRAO_TELEFONE = /\+?\d{10,15}/g
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
