import { UUID } from '@/core/text/uuid'
import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { EsquemaPedaco, gravarPedaco } from '@/server/services/lote-de-importacao'
import { registrarPrimeiraOcorrencia } from '@/server/services/product-events'

type Ctx = { params: Promise<{ id: string }> }

/**
 * docs/103 CNV-020 · Grava um pedaço (até 500 fichas) de um lote aberto. `Idempotency-Key` por pedaço,
 * e mesmo sem ela o par (lote, linha) do banco não deixa a mesma ficha entrar duas vezes. Erro por
 * linha volta com o número da linha; o resto do pedaço entra.
 */
export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  const escopo = exigirPermissao(ctx.papel, 'client:create')
  if (escopo === 'own') throw new AppError('FORBIDDEN', { message: 'Importar a base é com o dono, a gerência ou a recepção.' })
  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Não achei esta importação. Comece de novo pelo arquivo.' })
  const pedaco = await lerCorpo(req, EsquemaPedaco)
  const db = await criarClienteDoUsuario()

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/imports/${id}/rows` }, async () => {
    const resultado = await gravarPedaco(db, ctx.tenantId, id, pedaco)
    // Sem nome nem telefone na trilha: só contadores (o `after` vira jsonb, já foi ponto cego de LGPD).
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: 'client.import_rows',
        entity: 'import_batches',
        entityId: id,
        after: {
          gravadas: resultado.gravadas,
          jaGravadas: resultado.jaGravadas,
          puladas: resultado.puladas.length,
          erros: resultado.erros.length,
          status: resultado.lote.status,
          rowsWritten: resultado.lote.rowsWritten,
        },
        requestId,
      },
      req,
    )
    return resultado
  })

  // G-05b: o mesmo marco das outras portas, uma vez por salão (a função se protege da repetição).
  if (resultado.gravadas > 0) {
    await registrarPrimeiraOcorrencia(db, ctx.tenantId, 'base_importada', { via: 'esteira', importados: resultado.gravadas })
  }
  return resultado
})
