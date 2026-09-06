import { exigirPermissao, type Escopo } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { extratoDeComissao } from '@/server/services/comissao'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATA = /^\d{4}-\d{2}-\d{2}$/

/**
 * `docs/53` C-01 — o coração da trava. Com alcance `own` (papel `professional`), o parâmetro
 * `professionalId` da query string é **ignorado por completo**: usar o "próprio id" é resolvido
 * fora daqui (via `my_professional_id`, a mesma função que a RLS usa em `can_see_appointment`) e
 * chega pronto em `professionalIdProprio`. Um profissional nunca escolhe QUEM ele é.
 *
 * Extraída da rota para ficar testável sem HTTP, sem banco e sem mock de `contextoAtual`: é
 * lógica pura, e é exatamente a lógica que não pode errar.
 */
export function resolverProfessionalIdDoExtrato(
  escopo: Escopo,
  professionalIdDaQuery: string | null,
  professionalIdProprio: string | null,
): string {
  if (escopo === 'own') {
    // Falha fechada: papel `professional` sem linha em `professionals` (estado que não deveria
    // existir, mas RLS de duas camadas é exatamente para o dia em que existir) não vê extrato
    // nenhum — nunca cai para "então mostra tudo".
    if (!professionalIdProprio) throw new AppError('FORBIDDEN')
    return professionalIdProprio
  }

  if (!professionalIdDaQuery || !UUID.test(professionalIdDaQuery)) throw AppError.validacao({ professionalId: 'Escolha um profissional.' })
  return professionalIdDaQuery
}

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  const escopo = exigirPermissao(ctx.papel, 'commission:read')

  const params = new URL(req.url).searchParams
  const desde = params.get('desde')
  const ate = params.get('ate')

  if (!desde || !DATA.test(desde)) throw AppError.validacao({ desde: 'Informe a data de início (AAAA-MM-DD).' })
  if (!ate || !DATA.test(ate)) throw AppError.validacao({ ate: 'Informe a data de fim (AAAA-MM-DD).' })

  const db = await criarClienteDoUsuario()

  let professionalIdProprio: string | null = null
  if (escopo === 'own') {
    const { data, error } = await db.rpc('my_professional_id', { t: ctx.tenantId })
    if (error) throw new AppError('INTERNAL', { cause: error })
    professionalIdProprio = data
  }

  const professionalId = resolverProfessionalIdDoExtrato(escopo, params.get('professionalId'), professionalIdProprio)

  // O período é dito em datas do salão, não em UTC — mesma leitura que `cash/daily` faz antes de
  // chamar o fechamento. Sem isto, comanda fechada às 22h em Brasília cai no mês seguinte.
  const { data: tenant, error } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })

  return extratoDeComissao(db, ctx.tenantId, professionalId, tenant?.timezone ?? 'America/Sao_Paulo', desde, ate)
})
