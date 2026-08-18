import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerJson } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { EsquemaMapeamento, importarClientes } from '@/server/services/importacao-clientes'

const TAMANHO_MAXIMO = 5 * 1024 * 1024

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:create')

  const form = await req.formData().catch(() => null)
  const arquivo = form?.get('file')
  const mapeamentoBruto = form?.get('mapping')
  if (!(arquivo instanceof File)) throw AppError.validacao({ file: 'Envie um arquivo CSV.' })
  if (arquivo.size > TAMANHO_MAXIMO) throw AppError.validacao({ file: 'Arquivo maior que 5 MB.' })
  if (typeof mapeamentoBruto !== 'string') throw AppError.validacao({ mapping: 'Envie o mapeamento de colunas.' })

  let mapeamentoJson: unknown
  try {
    mapeamentoJson = JSON.parse(mapeamentoBruto)
  } catch {
    throw AppError.validacao({ mapping: 'Mapeamento de colunas inválido.' })
  }
  const mapeamento = lerJson(EsquemaMapeamento, mapeamentoJson)

  const texto = await arquivo.text()
  const db = await criarClienteDoUsuario()

  const resultado = await importarClientes(db, ctx.tenantId, texto, mapeamento)

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'client.import',
      entity: 'clients',
      after: { imported: resultado.imported, skipped: resultado.skipped.length, errors: resultado.errors.length },
      requestId,
    },
    req,
  )

  return resultado
})
