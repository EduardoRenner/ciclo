import type { z } from 'zod'

import { AppError } from './errors'

/** O erro do Zod vira `details.fields`, no formato que a UI usa para marcar o campo por vez. */
function validarComZod<S extends z.ZodType>(schema: S, dado: unknown): z.infer<S> {
  const resultado = schema.safeParse(dado)
  if (!resultado.success) {
    const campos: Record<string, string> = {}
    for (const problema of resultado.error.issues) {
      const campo = problema.path.join('.') || '_corpo'
      // Primeira mensagem por campo: a UI mostra uma linha embaixo do input.
      campos[campo] ??= problema.message
    }
    throw AppError.validacao(campos)
  }
  return resultado.data as z.infer<S>
}

/**
 * Toda entrada de usuário passa por aqui antes de tocar no banco (regra 7 do
 * CLAUDE.md). Lê de um **clone**, não de `req` direto: toda rota de mutação
 * chama `comIdempotencia(req, ...)` depois desta função, e o Fetch API
 * proíbe clonar um corpo que já foi consumido ("TypeError: unusable").
 * Testes de integração nunca pegaram isso — constroem `Request` com body de
 * string, que alguns runtimes deixam clonar mesmo depois de lido; um `fetch`
 * de navegador de verdade contra o servidor real não perdoa. Achado ao vivo
 * testando `PATCH /api/v1/tenant` pela UI (o primeiro teste de navegador
 * real contra uma rota autenticada nesta base — TICKET-022 registrava esse
 * limite de verificação). Afetava **toda** rota com idempotência, não só a
 * nova.
 */
export async function lerCorpo<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let cru: unknown
  try {
    cru = await req.clone().json()
  } catch {
    throw AppError.validacao({ _corpo: 'Envie um JSON válido.' })
  }

  return validarComZod(schema, cru)
}

/** Mesma validação de `lerCorpo`, para dado que já chegou como objeto — o caso de um campo de multipart que carrega JSON dentro. */
export function lerJson<S extends z.ZodType>(schema: S, dado: unknown): z.infer<S> {
  return validarComZod(schema, dado)
}
