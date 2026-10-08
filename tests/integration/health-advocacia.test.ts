import { createHmac, randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { verificarSaude } from '@/server/services/health'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const URL_BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svc = createClient<Database>(URL_BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * docs/101 §15: as três checagens do pacote no `/api/health`. Cada "não acusa" tem um "acusa" no mesmo
 * cenário (controle positivo), e o texto público nunca leva OAB nem nome de escritório.
 */
let T: string
let profissao: string
const usuarios: string[] = []
const OAB = `oab:${Math.floor(Math.random() * 9e5) + 1e5}/SC`

/** RFC 6238 (TOTP, SHA-1, 30 s, 6 dígitos) a partir do segredo base32 que o enroll devolve. */
function totp(base32: string, agora = Date.now()): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of base32.replace(/=+$/, '').toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0')
  const chave = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(Math.floor(agora / 30_000)))
  const h = createHmac('sha1', chave).update(contador).digest()
  const o = h[h.length - 1]! & 0xf
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

/** TOTP desligado no contêiner local que subiu antes do `config.toml` ligar (a CI sobe do zero e liga). */
class EnrollDesligado extends Error {}

async function membro(diasAtras: number, comFator: boolean): Promise<string> {
  const email = `health-adv-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const u = await svc.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (u.error || !u.data.user) throw new Error(u.error?.message)
  usuarios.push(u.data.user.id)
  const criado = new Date(Date.now() - diasAtras * 86_400_000).toISOString()
  const m = await svc.from('memberships').insert({ tenant_id: T, user_id: u.data.user.id, role: 'professional', created_at: criado })
  if (m.error) throw new Error(m.error.message)
  if (comFator) {
    const c = createClient(URL_BANCO, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    if ((await c.auth.signInWithPassword({ email, password: senha })).error) throw new Error('login')
    const e = await c.auth.mfa.enroll({ factorType: 'totp' })
    if (e.error && /enroll is disabled/i.test(e.error.message)) throw new EnrollDesligado(e.error.message)
    if (e.error) throw new Error(`enroll: ${e.error.message}`)
    const v = await c.auth.mfa.challengeAndVerify({ factorId: e.data.id, code: totp(e.data.totp.secret) })
    if (v.error) throw new Error(`verify: ${v.error.message}`)
  }
  return u.data.user.id
}

const semFatorDeste = async () => ((await svc.rpc('legal_membros_sem_segundo_fator', { p_dias: 7 })).data ?? []).find((l) => l.tenant_id === T)?.sem_fator ?? 0

beforeAll(async () => {
  const p = await svc.from('professions').select('id').eq('pacote', 'advocacia').single()
  if (p.error) throw new Error(`profissão advocacia: ${p.error.message}`)
  profissao = p.data.id
  const t = await svc
    .from('tenants')
    .insert({ name: 'Escritório da saúde', slug: `health-adv-${randomUUID().slice(0, 8)}`, vertical: 'general', profession_id: profissao })
    .select('id')
    .single()
  if (t.error) throw new Error(t.error.message)
  T = t.data.id
}, 60_000)

afterAll(async () => {
  await svc.from('legal_intimation_sync').delete().eq('tenant_id', T)
  await svc.from('tenants').delete().eq('id', T)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('legalIntimacoes: reconciliação da captura', () => {
  const hoje = new Date().toISOString().slice(0, 10)

  it('dia com tudo gravado não acusa; dia incompleto acusa com a data e sem a OAB', async () => {
    const ok = await svc.from('legal_intimation_sync').insert({ tenant_id: T, alvo: OAB, dia: hoje, count_fonte: 4, count_gravado: 4, ok: true })
    if (ok.error) throw new Error(ok.error.message)
    const antes = await verificarSaude(svc)
    expect(antes.checks.legalIntimacoes.detail ?? '').not.toMatch(/faltam intimações/)

    await svc.from('legal_intimation_sync').update({ count_gravado: 3 }).eq('tenant_id', T).eq('dia', hoje)
    const depois = await verificarSaude(svc)
    expect(depois.checks.legalIntimacoes).toEqual({ ok: false, detail: expect.stringContaining(`faltam intimações de ${hoje}`) })
    expect(depois.checks.legalIntimacoes.detail).not.toContain(OAB.slice(4))
    expect(depois.ok).toBe(false)
  }, 60_000)

  it('ok = false também acusa (a captura disse que falhou)', async () => {
    await svc.from('legal_intimation_sync').update({ count_gravado: 4, ok: false }).eq('tenant_id', T).eq('dia', hoje)
    expect((await verificarSaude(svc)).checks.legalIntimacoes.ok).toBe(false)
  }, 60_000)

  it('dia de mais de 3 dias atrás não acusa mais (a janela anda)', async () => {
    const velho = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10)
    await svc.from('legal_intimation_sync').update({ dia: velho }).eq('tenant_id', T).eq('dia', hoje)
    expect((await verificarSaude(svc)).checks.legalIntimacoes.detail ?? '').not.toContain(velho)
  }, 60_000)
})

describe('legalFila', () => {
  it('as leituras da fila respondem', async () => {
    expect((await verificarSaude(svc)).checks.legalFila).toEqual({ ok: true })
  }, 60_000)
})

describe('legalMfa: membro sem segundo fator', () => {
  it('conta só quem está há mais de 7 dias', async () => {
    expect(await semFatorDeste()).toBe(0)
    await membro(1, false) // novo demais: ainda tem tempo
    expect(await semFatorDeste()).toBe(0)
    await membro(10, false) // antigo, sem fator: este conta
    expect(await semFatorDeste()).toBe(1)
  }, 120_000)

  it('quem tem fator verificado não conta', async (ctx) => {
    try {
      await membro(10, true)
    } catch (e) {
      if (!(e instanceof EnrollDesligado)) throw e
      // Na CI o Supabase sobe com o `config.toml` (TOTP ligado): lá pular seria esconder o caso.
      if (process.env.CI) throw new Error(`TOTP desligado na CI: ${e.message}`)
      return ctx.skip()
    }
    expect(await semFatorDeste()).toBe(1)
  }, 120_000)

  it('é amarelo: ok continua true, o aviso vai escrito sem nome', async () => {
    const r = (await verificarSaude(svc)).checks.legalMfa
    expect(r.ok).toBe(true)
    expect(r.detail).toMatch(/sem segundo fator há mais de 7 dias/)
  }, 60_000)

  it('a função não é chamável por usuário logado (só a service_role)', async () => {
    const c = createClient<Database>(URL_BANCO, ANON, { auth: { persistSession: false } })
    const r = await c.rpc('legal_membros_sem_segundo_fator', { p_dias: 7 })
    expect(r.error?.message ?? '').toMatch(/permission denied/)
  })
})
