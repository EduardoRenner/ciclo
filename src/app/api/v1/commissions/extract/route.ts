import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { extratoDeComissao } from '@/server/services/comissao'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATA = /^\d{4}-\d{2}-\d{2}$/

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'commission:read')

  const params = new URL(req.url).searchParams
  const professionalId = params.get('professionalId')
  const desde = params.get('desde')
  const ate = params.get('ate')

  if (!professionalId || !UUID.test(professionalId)) throw AppError.validacao({ professionalId: 'Escolha um profissional.' })
  if (!desde || !DATA.test(desde)) throw AppError.validacao({ desde: 'Informe a data de início (AAAA-MM-DD).' })
  if (!ate || !DATA.test(ate)) throw AppError.validacao({ ate: 'Informe a data de fim (AAAA-MM-DD).' })

  const db = await criarClienteDoUsuario()
  // O período é dito em datas do salão, não em UTC — mesma leitura que `cash/daily` faz antes de
  // chamar o fechamento. Sem isto, comanda fechada às 22h em Brasília cai no mês seguinte.
  const { data: tenant, error } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })

  return extratoDeComissao(db, ctx.tenantId, professionalId, tenant?.timezone ?? 'America/Sao_Paulo', desde, ate)
})
