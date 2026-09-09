import type { SupabaseClient } from '@supabase/supabase-js'

import { SLUG_PROFISSAO_GENERICA } from '@/core/profissoes'
import { gerarDekCifrada } from '@/server/crypto/kek'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'

/**
 * As 8 verticais do enum original (0001) — `vertical_packs` tem catálogo rico e testado pra 6
 * delas. Profissão fora desta lista usa `apply_profession_pack()` (profession_services, P0+P5)
 * em vez de `apply_vertical_pack()` — ver comentário completo na migration 0031.
 */
const VERTICAIS_LEGADAS = new Set<Database['public']['Enums']['vertical_pack']>([
  'barber',
  'nails',
  'lashes',
  'brows',
  'waxing',
  'aesthetics',
  'tattoo',
  'hair',
])

export type ParametrosOnboarding = {
  userId: string
  businessName: string
  vertical: Database['public']['Enums']['vertical_pack']
  slug: string
  timezone: string
  /**
   * docs/09-PLATAFORMA.md §7/P4: opcional e retrocompatível — quem não manda continua exatamente
   * como antes (só `vertical`, `apply_vertical_pack`). Quem manda ganha `profession_id` + os 4
   * eixos no tenant, e — se a profissão não for uma das 8 legadas — o catálogo novo em vez do
   * antigo.
   */
  professionId?: string
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

  let profissao: { id: string; slug: string; onde: string; cobranca: string; inicio: string; ritmo: string } | null = null
  if (params.professionId) {
    const { data, error } = await svc
      .from('professions')
      .select('id, slug, onde, cobranca, inicio, ritmo')
      .eq('id', params.professionId)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (!data) throw AppError.validacao({ professionId: 'Essa profissão não existe mais.' })
    profissao = data
  }

  const { data: tenant, error: erroTenant } = await svc
    .from('tenants')
    .insert({
      name: params.businessName,
      slug: params.slug,
      vertical: params.vertical,
      timezone: params.timezone,
      /*
        Os quatro eixos vêm da profissão — MENOS quando ela é a genérica.

        `podeUsarModulo` trata eixo nulo como "ainda não respondido" e não esconde nada por causa
        dele; só um valor CONHECIDO e incompatível esconde. Quem escolheu "Outra profissão" não
        descreveu como atende, então gravar quatro valores por ela seria inventar uma resposta — e
        uma resposta errada aqui APAGA módulo da interface (`routing`, `recurrence`, `quotes`) sem
        tela nenhuma para corrigir: os eixos são gravados uma vez só, neste insert.

        Nulo mantém tudo visível, que é o lado seguro de errar. `profession_id` continua gravado:
        a pessoa escolheu uma linha do catálogo, e saber quantos caíram na genérica é o sinal de
        qual profissão falta no catálogo.
      */
      ...(profissao
        ? {
            profession_id: profissao.id,
            ...(profissao.slug === SLUG_PROFISSAO_GENERICA
              ? {}
              : { onde: profissao.onde, cobranca: profissao.cobranca, inicio: profissao.inicio, ritmo: profissao.ritmo }),
          }
        : {}),
    })
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

    // Profissão nova (fora das 8 legadas) usa o catálogo de profession_services — as 8
    // legadas continuam no vertical_packs de sempre, mesmo quando escolhidas via professionId
    // (ex.: barber também tem profession_services agora, de P5, mas trocar de catálogo aqui
    // seria mudar comportamento de quem já funciona sem necessidade).
    const usaPackNovo = profissao && !VERTICAIS_LEGADAS.has(params.vertical)
    const { error: erroPack } = usaPackNovo
      ? await svc.rpc('apply_profession_pack', { p_tenant: tenant.id, p_profession_id: profissao!.id })
      : await svc.rpc('apply_vertical_pack', { p_tenant: tenant.id, p_vertical: params.vertical })
    if (erroPack) throw erroPack
  } catch (erro) {
    // Desfaz o tenant recém-criado. Se ESTE delete falha em silêncio, sobra um tenant órfão no
    // banco para sempre — a pessoa vê o erro e vai embora, e o registro fica. O erro original
    // continua sendo o que sobe; o do rollback vira alarme, porque são causas diferentes e
    // trocar uma pela outra esconderia por que o cadastro falhou.
    const { error: erroRollback } = await svc.from('tenants').delete().eq('id', tenant.id)
    if (erroRollback) {
      console.error(
        JSON.stringify({ level: 'error', event: 'onboarding_rollback_falhou', tenant_id: tenant.id }),
        erroRollback,
      )
    }
    throw new AppError('INTERNAL', { cause: erro })
  }

  return { tenant }
}
