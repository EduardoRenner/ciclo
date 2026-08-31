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
/**
 * Teto de corpo, em bytes (auditoria de segurança de 31/08/2026).
 *
 * `req.json()` carrega o corpo INTEIRO na memória antes de o Zod ver o primeiro campo — então,
 * sem teto aqui, o `max()` de cada schema chegava tarde demais: a memória já tinha sido gasta.
 * Na Vercel a plataforma corta em ~4,5 MB, o que limita o estrago em produção; mas isso é o
 * limite de OUTRA pessoa, some em qualquer outro deploy (self-host, container, dev local) e não
 * está escrito em lugar nenhum deste repositório.
 *
 * 512 KB é ordens de grandeza acima do maior corpo legítimo do app — o campeão é a importação de
 * clientes, e ela manda o arquivo em `multipart`, que nem passa por aqui. Upload de imagem também
 * não: vai por `formData()`, com teto próprio de 2 MB/10 MB nos respectivos serviços.
 */
const TAMANHO_MAX_CORPO = 512 * 1024

export async function lerCorpo<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  /*
   * `content-length` é dica de quem chamou, não prova — por isso ele é só o atalho barato (recusa
   * antes de ler um byte) e a contagem real acontece depois, sobre o texto que de fato chegou.
   * Confiar só no header deixaria passar corpo sem `content-length` (chunked).
   */
  const declarado = Number(req.headers.get('content-length'))
  if (Number.isFinite(declarado) && declarado > TAMANHO_MAX_CORPO) {
    throw AppError.validacao({ _corpo: 'Esse envio é grande demais.' })
  }

  let texto: string
  try {
    texto = await req.clone().text()
  } catch {
    throw AppError.validacao({ _corpo: 'Envie um JSON válido.' })
  }

  // `Buffer.byteLength`, não `texto.length`: acento e emoji ocupam mais de um byte, e o que
  // importa aqui é o que trafegou.
  if (Buffer.byteLength(texto, 'utf8') > TAMANHO_MAX_CORPO) {
    throw AppError.validacao({ _corpo: 'Esse envio é grande demais.' })
  }

  let cru: unknown
  try {
    cru = JSON.parse(texto)
  } catch {
    throw AppError.validacao({ _corpo: 'Envie um JSON válido.' })
  }

  return validarComZod(schema, cru)
}

/** Mesma validação de `lerCorpo`, para dado que já chegou como objeto — o caso de um campo de multipart que carrega JSON dentro. */
export function lerJson<S extends z.ZodType>(schema: S, dado: unknown): z.infer<S> {
  return validarComZod(schema, dado)
}
