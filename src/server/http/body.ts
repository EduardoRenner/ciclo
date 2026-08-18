import type { z } from 'zod'

import { AppError } from './errors'

/**
 * Toda entrada de usuário passa por aqui antes de tocar no banco (regra 7 do
 * CLAUDE.md). O erro do Zod vira `details.fields`, no formato que a UI usa para
 * marcar o campo — mensagem por campo, em pt-BR, escrita no schema.
 */
export async function lerCorpo<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let cru: unknown
  try {
    cru = await req.json()
  } catch {
    throw AppError.validacao({ _corpo: 'Envie um JSON válido.' })
  }

  const resultado = schema.safeParse(cru)
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
