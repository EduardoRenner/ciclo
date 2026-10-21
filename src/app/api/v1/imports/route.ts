import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { abrirLote, EsquemaAbrirLote } from '@/server/services/lote-de-importacao'

/**
 * docs/103 CNV-020 · Abre o lote de uma importação. Recebe só o que a esteira concluiu no aparelho
 * (hash do arquivo, formato, nível, contagens): nem o arquivo nem o nome dele saem do aparelho.
 * O mesmo arquivo com lote vivo devolve o lote que já existe, com quantas linhas já entraram.
 *
 * `client:create`: a mesma autoridade da importação por planilha e do "já atendo".
 */
export const POST = rota(async (req, _params, requestId) => {
  const ctx = await contextoAtual(req)
  const escopo = exigirPermissao(ctx.papel, 'client:create')
  // `own` (profissional): a base do salão inteiro não é a carteira de um profissional só.
  if (escopo === 'own') throw new AppError('FORBIDDEN', { message: 'Importar a base é com o dono, a gerência ou a recepção.' })
  const entrada = await lerCorpo(req, EsquemaAbrirLote)
  const db = await criarClienteDoUsuario()

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/imports' }, async () => {
    const resultado = await abrirLote(db, ctx.tenantId, ctx.sessao.userId, entrada)
    if (!resultado.jaExistia) {
      await writeAudit(
        {
          tenantId: ctx.tenantId,
          actorId: ctx.sessao.userId,
          actorRole: ctx.papel,
          action: 'import.open',
          entity: 'import_batches',
          entityId: resultado.lote.id,
          after: { formato: entrada.formato, origem: entrada.origem, nivel: entrada.nivel, rowsExpected: entrada.rowsExpected },
          requestId,
        },
        req,
      )
    }
    return resultado
  })
})
