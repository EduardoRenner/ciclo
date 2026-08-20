import { limitador } from '@/server/services/rate-limit'

import { AppError } from './errors'
import { ipDe } from './ip'
import { resolverRequestId, respostaErro, respostaOk } from './response'

type Handler<Ctx> = (req: Request, ctx: Ctx, requestId: string) => Promise<unknown>

/**
 * TICKET-057, "rate limit global": um teto por IP em cima de toda `/api/v1`
 * (e das rotas de cron/health, que também passam por `rota()` — o volume delas
 * é ínfimo perto de 120/min, então não têm por que ficar de fora). É a rede
 * embaixo dos limites finos que cada rota sensível já tem (login, booking
 * público…): aquelas continuam existindo porque sabem o que estão limitando
 * (tentativa de senha, agendamento); esta aqui só sabe que é IP demais batendo
 * rápido demais em qualquer coisa.
 */
const LIMITE_GLOBAL = { limite: 120, janelaSegundos: 60 }

const METODOS_MUTANTES = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * V2 (verificação estrutural, Gate 5.1.5): a sessão é cookie automático — o navegador manda
 * ele sozinho em qualquer requisição pro domínio, inclusive vinda de outro site. `SameSite=Lax`
 * do cookie do Supabase já bloqueia a maioria dos casos, mas o checklist pede a segunda camada:
 * conferir `Origin` explicitamente nas rotas que escrevem. Ausência de `Origin` **passa** —
 * é o caso normal de chamada servidor-a-servidor (cron com `CRON_SECRET`, webhook com
 * assinatura própria), nenhuma delas manda esse header; só um valor **presente e diferente**
 * do host desta própria requisição é sinal de navegador sendo usado a partir de outro site.
 *
 * V3 (achado ao vivo, testando a jornada de agendamento público de verdade): a primeira versão
 * comparava contra `NEXT_PUBLIC_APP_URL` fixo — quebrou o booking público na hora, porque o
 * preview local roda numa porta diferente da configurada na env var (e o mesmo aconteceria em
 * qualquer deploy preview da Vercel, com subdomínio dinâmico, ou custom domain). O jeito certo
 * de checar "mesma origem" é contra o `Host` **desta própria requisição**, não contra uma URL
 * fixa — assim funciona em qualquer domínio que o Next esteja servindo de verdade.
 */
function origemValida(req: Request): boolean {
  if (!METODOS_MUTANTES.has(req.method)) return true
  const origin = req.headers.get('origin')
  if (!origin) return true
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (!host) return true // sem Host não dá pra comparar — não é o momento de travar toda escrita por isso
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

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
      if (!origemValida(req)) throw new AppError('FORBIDDEN', { message: 'Origem da requisição não confere.' })

      const { permitido } = await limitador(`global:ip:${ipDe(req)}`, LIMITE_GLOBAL)
      if (!permitido) throw AppError.limiteDeTaxa(LIMITE_GLOBAL.janelaSegundos)

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
