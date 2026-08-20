import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import { abrirDekCifrada } from '@/server/crypto/kek'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Mesma régua do `tests/rls/isolation.test.ts`: falta de credencial não pode
 * virar teste verde. Este arquivo é o único E2E dos 5 fluxos críticos da
 * FAQ A37 que roda fora do Playwright — testa a sequência real de escritas
 * contra o projeto de verdade, não uma cópia mockada do banco.
 */
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error(
    'O teste de onboarding precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.',
  )
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const tenantsParaLimpar: string[] = []
const usuariosParaLimpar: string[] = []

async function criarUsuario(sufixo: string) {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `onboarding-${sufixo}-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: `Bruna ${sufixo}` },
  })
  if (error || !data.user) throw new Error(`seed falhou ao criar usuário: ${error?.message}`)
  usuariosParaLimpar.push(data.user.id)
  return data.user.id
}

afterAll(async () => {
  for (const id of tenantsParaLimpar) await svc.from('tenants').delete().eq('id', id)
  for (const id of usuariosParaLimpar) await svc.auth.admin.deleteUser(id)
}, 60_000)

describe('executarOnboarding — contra o projeto real', () => {
  it(
    'cria tenant, membership de owner, professional, a DEK e aplica o pack — tudo pronto',
    async () => {
      const userId = await criarUsuario('feliz')
      const slug = `bruna-cilios-${randomUUID().slice(0, 8)}`

      const { tenant } = await executarOnboarding(svc, {
        userId,
        businessName: 'Bruna Cílios',
        vertical: 'lashes',
        slug,
        timezone: 'America/Sao_Paulo',
      })
      tenantsParaLimpar.push(tenant.id)

      expect(tenant).toMatchObject({ name: 'Bruna Cílios', slug, vertical: 'lashes' })

      const membership = await svc
        .from('memberships')
        .select('role, active')
        .eq('tenant_id', tenant.id)
        .eq('user_id', userId)
        .single()
      expect(membership.data).toMatchObject({ role: 'owner', active: true })

      // O dono também vira profissional (senão não aparece na própria agenda).
      const profissional = await svc
        .from('professionals')
        .select('display_name, user_id, comp_model')
        .eq('tenant_id', tenant.id)
        .single()
      expect(profissional.data).toMatchObject({
        display_name: 'Bruna feliz',
        user_id: userId,
        comp_model: 'owner',
      })

      // A DEK existe, está cifrada (não é o literal '\x' vazio) e abre de
      // volta para exatos 32 bytes — prova de ida e volta com a KEK real do
      // ambiente, não com uma KEK de teste isolada.
      const chave = await svc.from('tenant_keys').select('dek_wrapped, key_version').eq('tenant_id', tenant.id).single()
      expect(chave.data?.dek_wrapped).toMatch(/^\\x[0-9a-f]{80,}$/)
      expect(abrirDekCifrada(chave.data!.dek_wrapped)).toHaveLength(32)

      // O pack de verdade rodou — não é um mock do apply_vertical_pack.
      // Contagem verificada no TICKET-004 para 'lashes': 6 serviços, 7 produtos,
      // 6 dias de expediente.
      const [servicos, produtos, expediente] = await Promise.all([
        svc.from('services').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
        svc.from('products').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
        svc.from('business_hours').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      ])
      expect(servicos.count).toBe(6)
      expect(produtos.count).toBe(7)
      expect(expediente.count).toBe(6)
    },
    60_000,
  )

  it(
    'dois cadastros com o mesmo slug: o segundo recebe VALIDATION_ERROR, não um 500',
    async () => {
      const slug = `salao-disputado-${randomUUID().slice(0, 8)}`
      const userA = await criarUsuario('a')
      const userB = await criarUsuario('b')

      const { tenant } = await executarOnboarding(svc, {
        userId: userA,
        businessName: 'Salão A',
        vertical: 'nails',
        slug,
        timezone: 'America/Sao_Paulo',
      })
      tenantsParaLimpar.push(tenant.id)

      const erro = await executarOnboarding(svc, {
        userId: userB,
        businessName: 'Salão B',
        vertical: 'nails',
        slug,
        timezone: 'America/Sao_Paulo',
      }).catch((e: unknown) => e)

      expect(erro).toMatchObject({ code: 'VALIDATION_ERROR', status: 422 })

      // B não ganhou tenant nenhum — nem o de A, nem um órfão.
      const deB = await svc.from('memberships').select('id').eq('user_id', userB)
      expect(deB.data).toEqual([])
    },
    60_000,
  )

  it(
    'vertical inválida na RPC desfaz o tenant inteiro — nada de cadastro pela metade',
    async () => {
      const userId = await criarUsuario('rollback')
      const slug = `vai-falhar-${randomUUID().slice(0, 8)}`

      // O Zod barraria isso antes de chegar aqui; forçamos passando direto pela
      // função para provar que o `catch` do próprio `executarOnboarding`
      // também segura — defesa em profundidade, não só validação de borda.
      const erro = await executarOnboarding(svc, {
        userId,
        businessName: 'Vai Falhar',
        vertical: 'vertical-que-nao-existe' as never,
        slug,
        timezone: 'America/Sao_Paulo',
      }).catch((e: unknown) => e)

      expect(erro).toMatchObject({ code: 'INTERNAL' })

      const sobrou = await svc.from('tenants').select('id').eq('slug', slug)
      expect(sobrou.data).toEqual([])

      const membershipOrfa = await svc.from('memberships').select('id').eq('user_id', userId)
      expect(membershipOrfa.data).toEqual([])
    },
    60_000,
  )
})

/**
 * P4 (docs/09-PLATAFORMA.md §7/§16 critério 4): achado crítico ao revisar o plano — o catálogo
 * de 17 profissões nunca foi ligado ao cadastro de verdade. Sem `professionId`, não existia
 * NENHUM jeito de uma eletricista se cadastrar. Estes testes provam a ponte nova.
 */
describe('executarOnboarding com professionId (P4)', () => {
  it(
    'profissão nova (fora das 8 legadas) usa apply_profession_pack — catálogo real, não vazio',
    async () => {
      const userId = await criarUsuario('eletricista')
      const slug = `eletricista-${randomUUID().slice(0, 8)}`

      const { data: profissao, error } = await svc.from('professions').select('id').eq('slug', 'eletricista').single()
      if (error) throw error

      const { tenant } = await executarOnboarding(svc, {
        userId,
        businessName: 'Eletricista do Bairro',
        vertical: 'general',
        professionId: profissao.id,
        slug,
        timezone: 'America/Sao_Paulo',
      })
      tenantsParaLimpar.push(tenant.id)

      expect(tenant.vertical).toBe('general')

      const tenantCompleto = await svc.from('tenants').select('profession_id, onde, cobranca, inicio, ritmo').eq('id', tenant.id).single()
      expect(tenantCompleto.data).toMatchObject({ profession_id: profissao.id, onde: 'vai_ate', cobranca: 'visita_hora' })

      // profession_services de eletricista tem 5 serviços reais (P5) — não pode nascer vazio.
      const servicos = await svc.from('services').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id)
      expect(servicos.count).toBe(5)

      const expediente = await svc.from('business_hours').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id)
      expect(expediente.count).toBe(6) // mesmo expediente padrão do apply_vertical_pack
    },
    60_000,
  )

  it(
    'profissão legada (barber) escolhida via professionId continua usando apply_vertical_pack — não regride pra profession_services',
    async () => {
      const userId = await criarUsuario('barbeiro')
      const slug = `barbeiro-catalogo-${randomUUID().slice(0, 8)}`

      const { data: profissao, error } = await svc.from('professions').select('id').eq('slug', 'barber').single()
      if (error) throw error

      const { tenant } = await executarOnboarding(svc, {
        userId,
        businessName: 'Barbearia via Catálogo',
        vertical: 'barber',
        professionId: profissao.id,
        slug,
        timezone: 'America/Sao_Paulo',
      })
      tenantsParaLimpar.push(tenant.id)

      // vertical_packs.barber tem um número de serviços diferente de
      // profession_services (barber) — a contagem abaixo prova qual dos dois rodou.
      const vertical_pack = await svc.from('vertical_packs').select('services').eq('vertical', 'barber').single()
      const numeroEsperado = (vertical_pack.data?.services as unknown[]).length

      const servicos = await svc.from('services').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id)
      expect(servicos.count).toBe(numeroEsperado)

      const tenantCompleto = await svc.from('tenants').select('profession_id').eq('id', tenant.id).single()
      expect(tenantCompleto.data?.profession_id).toBe(profissao.id) // eixos/profession_id são setados mesmo usando o pack antigo
    },
    60_000,
  )
})
