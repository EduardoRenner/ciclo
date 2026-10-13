import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { exportarConta } from '@/server/services/exportacao-conta'
import { limitador } from '@/server/services/rate-limit'

/** Uma por dia: "seus dados são seus" é argumento de confiança, e um limite mensal o desmentiria. */
const JANELA_SEGUNDOS = 24 * 3600

/**
 * `GET /api/v1/account/export 🔐` — CNV-009b: a conta inteira num `.zip` aberto e reimportável
 * (`core/exportacao`). Mesma régua de quem pode da exportação da base (FAQ C35): só o dono, com a
 * verificação em duas etapas na hora, e auditado. A diferença, registrada em DECISOES (2026-10-13):
 * uma vez por DIA, não por mês.
 *
 * A cota só é gasta DEPOIS de o arquivo ficar pronto (defeito D15 da auditoria: na exportação de
 * clientes, um erro no meio gastava a vez do mês sem entregar nada).
 */
export const GET = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  // A conta inteira é do negócio: o alcance `own` (só o que é "seu") não exporta a base (APR-040).
  const escopo = exigirPermissao(ctx.papel, 'client:export')
  if (escopo === 'own') throw new AppError('FORBIDDEN', { message: 'Só quem é dono do negócio pode baixar a conta inteira.' })
  const sessao = await exigirAal2()

  const db = await criarClienteDoUsuario()
  const { zip, contagens } = await exportarConta(db, ctx.tenantId, ctx.tenant.name)

  const { permitido } = await limitador(`account-export:tenant:${ctx.tenantId}`, { limite: 1, janelaSegundos: JANELA_SEGUNDOS })
  if (!permitido) {
    throw new AppError('RATE_LIMITED', {
      message: 'Você já baixou a conta inteira hoje. Tente de novo amanhã.',
      headers: { 'Retry-After': String(JANELA_SEGUNDOS) },
      details: { retryAfterSeconds: JANELA_SEGUNDOS },
    })
  }

  await writeAudit(
    { tenantId: ctx.tenantId, actorId: sessao.userId, actorRole: ctx.papel, action: 'account.export', entity: 'tenants', entityId: ctx.tenantId, after: contagens, requestId },
    req,
  )

  return new Response(new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': 'attachment; filename="ciclo-dados-do-negocio.zip"',
      'cache-control': 'no-store',
    },
  })
})
