import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { resumoMensal } from '@/server/services/caixa'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'report:read')

  const params = new URL(req.url).searchParams
  const month = params.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) throw AppError.validacao({ month: 'Informe o mês no formato AAAA-MM.' })

  const db = await criarClienteDoUsuario()
  const { data: tenant, error } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })

  return resumoMensal(db, ctx.tenantId, tenant?.timezone ?? 'America/Sao_Paulo', month)
})
