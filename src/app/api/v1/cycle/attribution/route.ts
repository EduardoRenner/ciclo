import { Temporal } from '@js-temporal/polyfill'

import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { receitaAtribuidaAoCiclo } from '@/server/services/atribuicao'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

/**
 * `?month=YYYY-MM`, padrão o mês corrente no fuso do tenant. Sem parâmetro `desde`/`ate` — a
 * tela só precisa de "este mês" (§2.4); um seletor de mês customizado fica para quando alguém
 * pedir.
 */
export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const db = await criarClienteDoUsuario()
  const { data: tenant, error } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  const timezone = tenant?.timezone ?? 'America/Sao_Paulo'

  const mesParam = new URL(req.url).searchParams.get('month')
  const hojeLocal = Temporal.Now.zonedDateTimeISO(timezone).toPlainDate()
  const mesReferencia = mesParam ? Temporal.PlainYearMonth.from(mesParam) : Temporal.PlainYearMonth.from(hojeLocal)

  const desde = mesReferencia.toPlainDate({ day: 1 }).toString()
  const ate = mesReferencia.toPlainDate({ day: mesReferencia.daysInMonth }).toString()

  return receitaAtribuidaAoCiclo(db, ctx.tenantId, timezone, desde, ate)
})
