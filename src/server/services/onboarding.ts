import type { SupabaseClient } from '@supabase/supabase-js'

import { gerarDekCifrada } from '@/server/crypto/kek'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'

export type ParametrosOnboarding = {
  userId: string
  businessName: string
  vertical: Database['public']['Enums']['vertical_pack']
  slug: string
  timezone: string
}

export type ResultadoOnboarding = {
  tenant: {
    id: string
    name: string
    slug: string
    vertical: Database['public']['Enums']['vertical_pack']
    timezone: string
  }
}

/**
 * O corpo do TICKET-015: cria tenant, membership, professional, a DEK e aplica
 * o pack de vertical — nessa ordem — e desfaz tudo se qualquer passo depois do
 * tenant falhar.
 *
 * Recebe o cliente de serviço já pronto, e não chama `withNovoTenant()`
 * sozinho, para este módulo não depender de `next/headers`: é o que permite o
 * teste de integração (`tests/integration/onboarding.test.ts`) chamar a mesma
 * função contra o projeto real, sem passar por uma rota HTTP.
 */
export async function executarOnboarding(
  svc: SupabaseClient<Database>,
  params: ParametrosOnboarding,
): Promise<ResultadoOnboarding> {
  const { data: perfil, error: erroPerfil } = await svc
    .from('profiles')
    .select('full_name')
    .eq('id', params.userId)
    .maybeSingle()
  if (erroPerfil) throw new AppError('INTERNAL', { cause: erroPerfil })

  const { wrapped, keyVersion } = gerarDekCifrada()

  const { data: tenant, error: erroTenant } = await svc
    .from('tenants')
    .insert({ name: params.businessName, slug: params.slug, vertical: params.vertical, timezone: params.timezone })
    .select('id, name, slug, vertical, timezone')
    .single()

  if (erroTenant) {
    // 23505 = unique_violation. O formato do slug já foi barrado pelo Zod
    // antes de chegar aqui — só sobra a corrida de dois cadastros pelo mesmo
    // endereço ao mesmo tempo.
    if (erroTenant.code === '23505') {
      throw AppError.validacao({ slug: 'Esse endereço já está em uso. Escolha outro.' })
    }
    throw new AppError('INTERNAL', { cause: erroTenant })
  }

  // Da linha daqui para baixo, uma falha não pode deixar tenant órfão sem
  // membership: ele ficaria invisível a todo mundo e sem dono para tentar de
  // novo. Um `try/catch` só desfaz tudo se qualquer passo falhar — não há
  // transação entre PostgREST e a RPC, então desfazer é apagar o tenant e
  // deixar o `on delete cascade` das FKs levar o resto.
  try {
    const { error: erroMembership } = await svc
      .from('memberships')
      .insert({ tenant_id: tenant.id, user_id: params.userId, role: 'owner' })
    if (erroMembership) throw erroMembership

    // Dono também é profissional no MVP solo: sem isso ele não aparece na
    // própria agenda depois do cadastro.
    const { error: erroProfissional } = await svc.from('professionals').insert({
      tenant_id: tenant.id,
      user_id: params.userId,
      display_name: perfil?.full_name ?? params.businessName,
      comp_model: 'owner',
    })
    if (erroProfissional) throw erroProfissional

    const { error: erroChave } = await svc
      .from('tenant_keys')
      .insert({ tenant_id: tenant.id, dek_wrapped: wrapped, key_version: keyVersion })
    if (erroChave) throw erroChave

    const { error: erroPack } = await svc.rpc('apply_vertical_pack', {
      p_tenant: tenant.id,
      p_vertical: params.vertical,
    })
    if (erroPack) throw erroPack
  } catch (erro) {
    await svc.from('tenants').delete().eq('id', tenant.id)
    throw new AppError('INTERNAL', { cause: erro })
  }

  return { tenant }
}
