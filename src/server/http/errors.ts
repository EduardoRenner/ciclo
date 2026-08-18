/**
 * Lista fechada de erros da API (`docs/02-API.md §1`). Adicionar código aqui sem
 * adicionar na documentação é o mesmo que inventar código: a UI trata pelo `code`,
 * nunca pela mensagem.
 */
export const ERROR_CODES = {
  UNAUTHENTICATED: { status: 401, message: 'Sua sessão expirou. Entre de novo para continuar.' },
  MFA_REQUIRED: { status: 401, message: 'Confirme o código de verificação em duas etapas para continuar.' },
  FORBIDDEN: { status: 403, message: 'Seu perfil não tem acesso a essa ação.' },
  TENANT_MISMATCH: { status: 403, message: 'Esse registro é de outro estabelecimento.' },
  NOT_FOUND: { status: 404, message: 'Não encontramos o que você procura.' },
  VALIDATION_ERROR: { status: 422, message: 'Confira os campos destacados e tente de novo.' },
  SLOT_TAKEN: { status: 409, message: 'Esse horário acabou de ser reservado.' },
  INVALID_TRANSITION: { status: 422, message: 'Esse agendamento não pode ir para esse estado.' },
  IDEMPOTENCY_KEY_REUSED: { status: 422, message: 'Essa operação já foi enviada com outro conteúdo.' },
  DEPOSIT_REQUIRED: { status: 402, message: 'Pague o sinal para confirmar o horário.' },
  PAYMENT_FAILED: { status: 402, message: 'O pagamento não foi aprovado. Tente outra forma.' },
  RATE_LIMITED: { status: 429, message: 'Muitas tentativas seguidas. Espere um instante e tente de novo.' },
  PLAN_LIMIT: { status: 402, message: 'Seu plano chegou ao limite. Faça upgrade para continuar.' },
  OPT_OUT: { status: 422, message: 'Essa cliente pediu para não receber mensagens.' },
  VAULT_LOCKED: { status: 423, message: 'Entre de novo para abrir a ficha de saúde.' },
  INTERNAL: { status: 500, message: 'Algo deu errado do nosso lado. Tente de novo em instantes.' },
} as const satisfies Record<string, { status: number; message: string }>

export type ErrorCode = keyof typeof ERROR_CODES

export type ErrorDetails = Record<string, unknown>

type OpcoesAppError = {
  /** Mensagem em pt-BR para a pessoa. Ignorada em `INTERNAL`, que nunca é customizável. */
  message?: string
  details?: ErrorDetails
  /** Headers extras da resposta, como o `Retry-After` do `RATE_LIMITED`. */
  headers?: Record<string, string>
  /** Erro original. Vai para o log do servidor, nunca para a resposta. */
  cause?: unknown
}

/**
 * O único erro que as rotas devem lançar. O que não for `AppError` vira
 * `INTERNAL` no handler global — de propósito: erro inesperado não escolhe a
 * própria mensagem nem o próprio status.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  /** O que a pessoa lê. Separado de `message` para deixar explícito o que sai na resposta. */
  readonly publicMessage: string
  readonly details: ErrorDetails | undefined
  readonly headers: Record<string, string> | undefined

  constructor(code: ErrorCode, opcoes: OpcoesAppError = {}) {
    const padrao = ERROR_CODES[code]
    // `INTERNAL` fica preso na mensagem canônica: é por onde vazaria o texto de
    // uma exceção do banco se alguém repassasse `err.message` sem pensar.
    const publica = code === 'INTERNAL' ? padrao.message : (opcoes.message ?? padrao.message)

    super(publica, opcoes.cause === undefined ? undefined : { cause: opcoes.cause })
    this.name = 'AppError'
    this.code = code
    this.status = padrao.status
    this.publicMessage = publica
    this.details = opcoes.details
    this.headers = opcoes.headers
  }

  /** Normaliza qualquer coisa lançada — inclusive string e objeto solto — em `AppError`. */
  static de(erro: unknown): AppError {
    if (erro instanceof AppError) return erro
    return new AppError('INTERNAL', { cause: erro })
  }

  /** `VALIDATION_ERROR` com o formato de `details.fields` que a UI espera. */
  static validacao(campos: Record<string, string>, message?: string): AppError {
    return new AppError('VALIDATION_ERROR', {
      ...(message === undefined ? {} : { message }),
      details: { fields: campos },
    })
  }

  /** `RATE_LIMITED` já com o `Retry-After` que a documentação exige. */
  static limiteDeTaxa(segundos: number): AppError {
    const espera = Math.max(1, Math.ceil(segundos))
    return new AppError('RATE_LIMITED', {
      headers: { 'Retry-After': String(espera) },
      details: { retryAfterSeconds: espera },
    })
  }
}
