import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Mesma regra dos outros testes desta pasta: falta de credencial NÃO vira teste
// verde. O que este arquivo guarda — ninguém apaga a chave que decifra as
// anamneses — é a correção da 0074, e um skip silencioso devolveria um buraco
// cujo estrago é PERMANENTE.
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    'O teste de tenant_keys precisa de NEXT_PUBLIC_SUPABASE_URL, ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.',
  )
}

/**
 * O buraco que a 0074 fechou, e como este teste o pega.
 *
 * Antes da 0074, `tenant_keys` entrava no laço de 25 tabelas da `0001:688-709` e recebia
 * `for all using (has_tenant(tenant_id))`. Qualquer membro do tenant — `professional` e
 * `reception` inclusive — que chamasse a REST API direto, com o próprio JWT, executava
 * `DELETE FROM tenant_keys WHERE tenant_id = '<o meu>'` e transformava TODA anamnese do
 * estabelecimento em ciphertext ilegível, para sempre: `dek_wrapped` é a única cópia da
 * chave, e a DEK em claro só existe no cache em memória de `crypto/vault.ts`.
 *
 * **Reintroduzir o defeito para conferir** (regra do CLAUDE.md): trocar a política da 0074 de
 * volta por `for all ... has_tenant` faz os três casos de escrita abaixo ficarem vermelhos.
 * O CI (job "Banco e RLS") aplica as migrations do zero a cada execução, então é lá que a
 * volta seria pega em PR.
 *
 * **Por que o caso de SELECT é tão importante quanto os de escrita:** a rota do cofre
 * (`api/v1/clients/[id]/vault/route.ts:29`) usa `criarClienteDoUsuario()`, não `service_role`.
 * `dekDoTenant` (`crypto/vault.ts:64`) lê esta tabela com o JWT do usuário. Se alguém "apertar
 * mais" derrubando o SELECT junto, o cofre para de abrir em produção e o sintoma aparece como
 * falha de criptografia, longe da causa. O caso de leitura existe para que essa regressão
 * fique vermelha aqui, e não no cliente.
 */

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let tenantId: string
let profEmail: string
let profSenha: string
const criados: string[] = [] // userIds para limpar

function exigir<T extends { id?: string }>(
  r: { data: T | null; error: { message: string } | null },
  onde: string,
): T & { id: string } {
  if (r.error) throw new Error(`seed falhou em ${onde}: ${r.error.message}`)
  if (!r.data?.id) throw new Error(`seed em ${onde} não devolveu id`)
  return r.data as T & { id: string }
}

async function entrar(): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInWithPassword({ email: profEmail, password: profSenha })
  if (error) throw new Error(`não consegui autenticar ${profEmail}: ${error.message}`)
  return c
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)

  tenantId = exigir(
    await admin
      .from('tenants')
      .insert({ name: `RLS chave ${marca}`, slug: `rls-chave-${marca}`, vertical: 'barber' })
      .select('id')
      .single(),
    'tenants',
  ).id

  // A DEK de mentira: o que importa aqui é a política da linha, não o conteúdo dela.
  const { error: erroChave } = await admin
    .from('tenant_keys')
    .insert({ tenant_id: tenantId, dek_wrapped: Buffer.from(`dek-falsa-${marca}`), key_version: 1 })
  if (erroChave) throw new Error(`seed falhou em tenant_keys: ${erroChave.message}`)

  profEmail = `rls-chave-${marca}@ciclo.test`
  profSenha = randomUUID()
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: profEmail,
    password: profSenha,
    email_confirm: true,
  })
  if (userError || !userData.user) throw new Error(`seed falhou ao criar usuário: ${userError?.message}`)
  criados.push(userData.user.id)

  exigir(
    await admin
      .from('memberships')
      .insert({ tenant_id: tenantId, user_id: userData.user.id, role: 'professional' })
      .select('id')
      .single(),
    'memberships',
  )
}, 180_000)

afterAll(async () => {
  await admin.from('tenants').delete().eq('id', tenantId)
  for (const id of criados) await admin.auth.admin.deleteUser(id)
}, 120_000)

describe('0074 · a chave do cofre não aceita escrita de membro do tenant', () => {
  it('um membro NÃO apaga a chave do próprio tenant — o estrago seria permanente', async () => {
    const c = await entrar()
    await c.from('tenant_keys').delete().eq('tenant_id', tenantId)

    // A asserção é sobre o ESTADO, não sobre o erro devolvido: sob RLS, um DELETE sem linha
    // visível/permitida devolve sucesso com zero linhas afetadas. Perguntar só pelo `error`
    // deixaria este teste passar com o defeito de volta.
    const { data, error } = await admin.from('tenant_keys').select('tenant_id').eq('tenant_id', tenantId)
    expect(error).toBeNull()
    expect((data ?? []).map((r) => r.tenant_id)).toEqual([tenantId])
  })

  it('um membro NÃO reescreve a chave (trocar dek_wrapped é o mesmo estrago)', async () => {
    const c = await entrar()
    await c.from('tenant_keys').update({ dek_wrapped: Buffer.from('sequestrada') }).eq('tenant_id', tenantId)

    const { data } = await admin.from('tenant_keys').select('dek_wrapped').eq('tenant_id', tenantId).single()
    const bytes = Buffer.from((data?.dek_wrapped as string).replace(/^\\x/, ''), 'hex')
    expect(bytes.toString()).not.toBe('sequestrada')
  })

  it('um membro NÃO insere chave para outro tenant', async () => {
    const outro = exigir(
      await admin
        .from('tenants')
        .insert({
          name: `RLS chave alvo ${randomUUID().slice(0, 8)}`,
          slug: `rls-chave-alvo-${randomUUID().slice(0, 8)}`,
          vertical: 'barber',
        })
        .select('id')
        .single(),
      'tenants alvo',
    ).id

    try {
      const c = await entrar()
      await c.from('tenant_keys').insert({ tenant_id: outro, dek_wrapped: Buffer.from('plantada'), key_version: 1 })

      const { data } = await admin.from('tenant_keys').select('tenant_id').eq('tenant_id', outro)
      expect(data ?? []).toEqual([])
    } finally {
      await admin.from('tenants').delete().eq('id', outro)
    }
  })

  it('mas CONTINUA lendo a própria chave — é assim que o cofre abre', async () => {
    // Se este caso ficar vermelho, o cofre parou em produção: `dekDoTenant` lê com o cliente
    // do usuário, não com service_role.
    const c = await entrar()
    const { data, error } = await c.from('tenant_keys').select('tenant_id').eq('tenant_id', tenantId)
    expect(error).toBeNull()
    expect((data ?? []).map((r) => r.tenant_id)).toEqual([tenantId])
  })
})
