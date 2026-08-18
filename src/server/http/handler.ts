import { AppError } from './errors'
import { resolverRequestId, respostaErro, respostaOk } from './response'

type Handler<Ctx> = (req: Request, ctx: Ctx, requestId: string) => Promise<unknown>

/**
 * Envelope de log. JSON estruturado, com `request_id` e `tenant_id`, sem PII —
 * por isso a query string nunca entra: `?q=` carrega nome de cliente.
 */
function registrar(nivel: 'warn' | 'error', req: Request, requestId: string, erro: AppError): void {
  const url = new URL(req.url)
  const linha = {
    level: nivel,
    request_id: requestId,
    tenant_id: req.headers.get('x-tenant-id') ?? null,
    method: req.method,
    path: url.pathname,
    code: erro.code,
    status: erro.status,
  }

  if (nivel === 'error') {
    // A causa fica só aqui. É o que a resposta esconde e o plantão precisa ver.
    console.error(JSON.stringify(linha), erro.cause ?? erro)
  } else {
    console.warn(JSON.stringify(linha))
  }
}

/**
 * Handler global das rotas de `/api/v1`. Garante três coisas que não podem
 * depender de disciplina de quem escreve a rota:
 *
 * 1. toda resposta sai no envelope de `docs/02-API.md §1`;
 * 2. todo erro vira `code` da lista fechada — o que não for `AppError` vira
 *    `INTERNAL`, sem stack e sem mensagem de banco na resposta;
 * 3. todo request tem `requestId`, no corpo e no header.
 */
// `Ctx` fica `unknown` por padrão para o retorno continuar aceitável no lugar do
// handler de rota do Next, que passa `{ params }` como segundo argumento.
export function rota<Ctx = unknown>(handler: Handler<Ctx>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const requestId = resolverRequestId(req.headers)

    try {
      const resultado = await handler(req, ctx, requestId)

      // Rota que precisa devolver binário (PDF, CSV) monta a própria Response;
      // o envelope não se aplica, mas o rastro continua valendo.
      if (resultado instanceof Response) {
        resultado.headers.set('x-request-id', requestId)
        return resultado
      }

      return respostaOk(resultado ?? null, { requestId })
    } catch (bruto) {
      const erro = AppError.de(bruto)
      registrar(erro.status >= 500 ? 'error' : 'warn', req, requestId, erro)
      return respostaErro(erro, requestId)
    }
  }
}
