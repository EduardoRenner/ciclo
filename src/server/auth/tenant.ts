import { cookies } from 'next/headers'

import { exigirSessao, type Sessao } from '@/server/auth/session'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'

import type { Papel } from '@/server/auth/rbac'

/** Nome fixado pelo briefing (`01-ESPEC-TECNICA §2.1`). */
export const COOKIE_TENANT = 'ciclo_tenant'

export type Contexto = {
  sessao: Sessao
  tenantId: string
  papel: Papel
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Resolve o tenant ativo e **revalida o membership em toda requisição**
 * (FAQ C27). O header e o cookie dizem qual tenant a pessoa quer; quem responde
 * se ela pode é o banco.
 */
export async function contextoAtual(req: Request): Promise<Contexto> {
  const sessao = await exigirSessao()
  const db = await criarClienteDoUsuario()

  const jar = await cookies()
  const pedido = req.headers.get('x-tenant-id') ?? jar.get(COOKIE_TENANT)?.value ?? null

  // Um valor que nem uuid é não vale uma ida ao banco, e a resposta é a mesma
  // que a de tenant alheio: quem forjou não descobre se o id existe.
  if (pedido !== null && !UUID.test(pedido)) throw new AppError('TENANT_MISMATCH')

  const { data: vinculos, error } = await db
    .from('memberships')
    .select('tenant_id, role')
    .eq('user_id', sessao.userId)
    .eq('active', true)
  if (error) throw new AppError('INTERNAL', { cause: error })

  const ativos = vinculos ?? []

  if (pedido !== null) {
    const escolhido = ativos.find((v) => v.tenant_id === pedido)
    // Mesmo erro para "tenant não existe" e "existe mas não é seu": a diferença
    // vira um verificador de quais estabelecimentos existem no CICLO.
    if (!escolhido) throw new AppError('TENANT_MISMATCH')
    return { sessao, tenantId: escolhido.tenant_id, papel: escolhido.role }
  }

  if (ativos.length === 0) {
    throw new AppError('FORBIDDEN', {
      message: 'Sua conta ainda não tem um estabelecimento. Termine o cadastro para continuar.',
    })
  }

  const unico = ativos[0]
  if (ativos.length > 1 || !unico) {
    throw AppError.validacao(
      { 'x-tenant-id': 'Escolha em qual estabelecimento você quer trabalhar.' },
      'Você atende em mais de um lugar. Escolha um para continuar.',
    )
  }

  return { sessao, tenantId: unico.tenant_id, papel: unico.role }
}
