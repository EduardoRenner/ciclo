import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { writeAudit } from '@/server/audit/write'
import { comIdempotencia } from '@/server/http/idempotency'
import { creditarCarteira } from '@/server/services/pacotes'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de idempotência precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
const tenants: string[] = []
const usuarios: string[] = []

/*
 * BL-42 (`.claude/ciclo/autonomous-backlog.md`): em pelo menos 49 rotas, `writeAudit` rodava FORA
 * do fechamento que `comIdempotencia` protege — uma repetição com a mesma `Idempotency-Key` (fila
 * offline reenviando, toque duplo) recebia a resposta CACHEADA sem repetir a mutação, mas ainda
 * gravava uma linha NOVA em `audit_log`, descrevendo uma ação que só aconteceu uma vez.
 *
 * Este teste prova o conserto contra o MECANISMO (`comIdempotencia` + `writeAudit`), não contra a
 * rota HTTP — chamar `wallet/credit/route.ts` de ponta a ponta exigiria simular sessão autenticada
 * por cookie, que é peso desnecessário para o que este achado é: a mesma combinação
 * `comIdempotencia(..., async () => { ...mutação...; await writeAudit(...); return resultado })`
 * que as 5 rotas de dinheiro corrigidas nesta rodada (`wallet/credit`, `wallet/debit`,
 * `tickets/[id]/close`, `billing/assinar`, `billing/cancelar`) agora usam.
 */
beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `idempotencia-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Idempotência' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Idempotência',
    vertical: 'barber',
    slug: `idempotencia-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

async function creditarComAuditoria(chave: string, clientId: string, requestId: string) {
  const req = new Request('http://test.local/api/v1/wallet/credit', { method: 'POST', headers: { 'idempotency-key': chave } })
  return comIdempotencia(req, { tenantId, endpoint: '/api/v1/wallet/credit' }, async () => {
    const balanceCents = await creditarCarteira(svc, tenantId, { clientId, amountCents: 5_000, reason: 'Teste BL-42' })
    await writeAudit(
      { tenantId, actorId: null, actorRole: 'owner', action: 'wallet.credit', entity: 'wallet_entries', entityId: clientId, after: { balanceCents }, requestId },
      req,
    )
    return balanceCents
  })
}

describe('writeAudit dentro do fechamento de comIdempotencia não duplica (BL-42)', () => {
  it('repetir a mesma Idempotency-Key não grava uma segunda linha em audit_log', async () => {
    const marca = randomUUID().slice(0, 6)
    const { data: cliente, error: erroCliente } = await svc.from('clients').insert({ tenant_id: tenantId, name: `Idempotente ${marca}` }).select('id').single()
    if (erroCliente) throw erroCliente

    const chave = randomUUID()

    const primeiro = await creditarComAuditoria(chave, cliente.id, randomUUID())
    const segundo = await creditarComAuditoria(chave, cliente.id, randomUUID())

    // Mesma resposta cacheada — é o comportamento que `comIdempotencia` já garantia.
    expect(segundo).toBe(primeiro)

    const { data: linhasDeAuditoria, error: erroAuditoria } = await svc
      .from('audit_log')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('action', 'wallet.credit')
      .eq('entity_id', cliente.id)
    if (erroAuditoria) throw erroAuditoria
    expect(linhasDeAuditoria, 'a repetição gravou uma segunda linha — writeAudit voltou a rodar fora do fechamento protegido').toHaveLength(1)

    // E o crédito em si também não duplicou — a mutação real só aconteceu na primeira chamada.
    const { data: lancamentos, error: erroLancamentos } = await svc.from('wallet_entries').select('id').eq('tenant_id', tenantId).eq('client_id', cliente.id)
    if (erroLancamentos) throw erroLancamentos
    expect(lancamentos).toHaveLength(1)
  })

  it('chaves DIFERENTES para a mesma pessoa geram, cada uma, sua própria linha de auditoria', async () => {
    // Controle: a guarda acima não pode estar "sempre 1" por acidente (ex.: um filtro que
    // esconderia linhas de verdade). Duas chaves distintas precisam produzir DUAS linhas.
    const marca = randomUUID().slice(0, 6)
    const { data: cliente, error: erroCliente } = await svc.from('clients').insert({ tenant_id: tenantId, name: `Duas Chaves ${marca}` }).select('id').single()
    if (erroCliente) throw erroCliente

    await creditarComAuditoria(randomUUID(), cliente.id, randomUUID())
    await creditarComAuditoria(randomUUID(), cliente.id, randomUUID())

    const { data: linhasDeAuditoria, error } = await svc
      .from('audit_log')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('action', 'wallet.credit')
      .eq('entity_id', cliente.id)
    if (error) throw error
    expect(linhasDeAuditoria).toHaveLength(2)
  })
})
