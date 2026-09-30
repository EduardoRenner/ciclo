import { COMO_SALVAR_EM_CSV, decodificarTexto, planilhaBinaria } from '@/core/text/decodificar-texto'
import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerJson } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { EsquemaMapeamento, importarClientes } from '@/server/services/importacao-clientes'
import { registrarPrimeiraOcorrencia } from '@/server/services/product-events'

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

  // BL-51: `arquivo.text()` é sempre UTF-8 e corrompia o CSV que o Excel em português salva.
  const bytes = await arquivo.arrayBuffer()
  // docs/83 P4: mesma recusa da prévia — quem pula a prévia não importa lixo.
  if (planilhaBinaria(bytes)) throw AppError.validacao({ file: COMO_SALVAR_EM_CSV })
  const texto = decodificarTexto(bytes)
  const db = await criarClienteDoUsuario()

  const resultado = await importarClientes(db, ctx.tenantId, texto, mapeamento)

  /*
   * G-05b (docs/60): mesmo marco de `clients/ja-atendo/route.ts` — "base_importada" pela outra
   * porta de entrada (CSV em vez de digitado de memória). `registrarPrimeiraOcorrencia` garante
   * que só a PRIMEIRA importação de verdade conta, não uma correção posterior.
   */
  if (resultado.imported > 0) {
    await registrarPrimeiraOcorrencia(db, ctx.tenantId, 'base_importada', { via: 'csv', importados: resultado.imported })
  }

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
