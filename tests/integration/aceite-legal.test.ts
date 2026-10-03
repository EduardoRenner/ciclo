import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { VERSOES_LEGAIS } from '@/core/legal/versoes'
import { aceitesPendentes, registrarReaceite } from '@/server/services/aceite-legal'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('O teste de aceite legal precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let userId: string

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `aceite-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true, user_metadata: { full_name: 'Dono do Aceite' } })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id
  const { tenant } = await executarOnboarding(svc, { userId, businessName: 'Salão do Aceite', vertical: 'barber', slug: `aceite-${marca}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  await svc.auth.admin.deleteUser(userId)
}, 60_000)

/** O comprovante é append-only para o usuário, mas o cliente de serviço pode refazer o cenário. */
async function refazerAceites(linhas: { documento: 'termos' | 'privacidade'; versao: string }[]) {
  await svc.from('terms_acceptances').delete().eq('tenant_id', tenantId)
  if (linhas.length > 0) {
    const { error } = await svc.from('terms_acceptances').insert(linhas.map((l) => ({ tenant_id: tenantId, user_id: userId, via: 'cadastro', ...l })))
    if (error) throw error
  }
}

async function linhas() {
  const { data } = await svc.from('terms_acceptances').select('documento, versao, via').eq('tenant_id', tenantId).order('aceito_em')
  return data ?? []
}

describe('reaceite dos termos e da política (docs/86 J8)', () => {
  it(
    'conta recém-criada aceitou a versão em vigor no cadastro: nada pendente',
    async () => {
      expect(await aceitesPendentes(svc, tenantId)).toEqual([])
    },
    30_000,
  )

  it(
    'versão antiga dos dois: ficam pendentes; o reaceite grava a versão EM VIGOR como "reaceite" e zera a pendência',
    async () => {
      await refazerAceites([
        { documento: 'termos', versao: '2026-01-01' },
        { documento: 'privacidade', versao: '2026-01-01' },
      ])
      expect(await aceitesPendentes(svc, tenantId)).toEqual(['termos', 'privacidade'])

      const r = await registrarReaceite(svc, tenantId, userId)
      expect(r.aceitos).toEqual(['termos', 'privacidade'])

      const gravadas = (await linhas()).filter((l) => l.via === 'reaceite')
      expect(gravadas).toHaveLength(2)
      expect(gravadas.find((l) => l.documento === 'termos')!.versao).toBe(VERSOES_LEGAIS.termos)
      expect(gravadas.find((l) => l.documento === 'privacidade')!.versao).toBe(VERSOES_LEGAIS.privacidade)
      // O comprovante antigo continua lá: aceitar a nova não apaga a prova da velha.
      expect((await linhas()).filter((l) => l.via === 'cadastro')).toHaveLength(2)

      expect(await aceitesPendentes(svc, tenantId)).toEqual([])
    },
    30_000,
  )

  it(
    'aceitar de novo sem pendência NÃO escreve nada (clique duplo não repete o comprovante)',
    async () => {
      const antes = (await linhas()).length
      const r = await registrarReaceite(svc, tenantId, userId)
      expect(r.aceitos).toEqual([])
      expect((await linhas()).length).toBe(antes)
    },
    30_000,
  )

  it(
    'só um documento desatualizado: o reaceite grava SÓ ele',
    async () => {
      await refazerAceites([
        { documento: 'termos', versao: VERSOES_LEGAIS.termos },
        { documento: 'privacidade', versao: '2026-01-01' },
      ])
      expect(await aceitesPendentes(svc, tenantId)).toEqual(['privacidade'])
      const r = await registrarReaceite(svc, tenantId, userId)
      expect(r.aceitos).toEqual(['privacidade'])
      const reaceites = (await linhas()).filter((l) => l.via === 'reaceite')
      expect(reaceites.map((l) => l.documento)).toEqual(['privacidade'])
    },
    30_000,
  )

  it(
    'conta SEM nenhum aceite (anterior à migration 0095) deve os dois, e o reaceite os grava',
    async () => {
      await refazerAceites([])
      expect(await aceitesPendentes(svc, tenantId)).toEqual(['termos', 'privacidade'])
      expect((await registrarReaceite(svc, tenantId, userId)).aceitos).toEqual(['termos', 'privacidade'])
      expect(await aceitesPendentes(svc, tenantId)).toEqual([])
    },
    30_000,
  )

  it(
    'o aceite de um negócio não alcança outro (a consulta filtra o tenant)',
    async () => {
      const marca = randomUUID().slice(0, 8)
      const { data } = await svc.auth.admin.createUser({ email: `aceite2-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true, user_metadata: { full_name: 'Outro Dono' } })
      const outroUser = data.user!.id
      const { tenant: outro } = await executarOnboarding(svc, { userId: outroUser, businessName: 'Outro Salão', vertical: 'barber', slug: `aceite2-${marca}`, timezone: 'America/Sao_Paulo' })
      try {
        await svc.from('terms_acceptances').delete().eq('tenant_id', outro.id)
        await refazerAceites([
          { documento: 'termos', versao: VERSOES_LEGAIS.termos },
          { documento: 'privacidade', versao: VERSOES_LEGAIS.privacidade },
        ])
        // Este negócio está em dia; o outro, sem nenhum aceite, não pode herdar isso.
        expect(await aceitesPendentes(svc, tenantId)).toEqual([])
        expect(await aceitesPendentes(svc, outro.id)).toEqual(['termos', 'privacidade'])
        // E registrar o reaceite do primeiro não toca no segundo.
        await registrarReaceite(svc, tenantId, userId)
        expect(await aceitesPendentes(svc, outro.id)).toEqual(['termos', 'privacidade'])
      } finally {
        await svc.from('tenants').delete().eq('id', outro.id)
        await svc.auth.admin.deleteUser(outroUser)
      }
    },
    60_000,
  )
})
