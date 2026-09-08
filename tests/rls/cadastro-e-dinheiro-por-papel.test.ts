import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Mesma regra dos outros testes desta pasta: falta de credencial NÃO vira teste verde. O que este
// arquivo guarda — o profissional não edita a própria comissão, nem lê o extrato do colega — é a
// correção da 0075, e um skip silencioso devolveria os dois buracos.
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    'O teste de cadastro e dinheiro por papel precisa de NEXT_PUBLIC_SUPABASE_URL, ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.',
  )
}

/**
 * Os buracos que a 0075 fechou, e por que `isolation.test.ts` nunca os pegou.
 *
 * A `0001:688-709` aplica `for all using (has_tenant(tenant_id))` a 25 tabelas, e `has_tenant`
 * só pergunta "é membro ativo?" — não olha papel. `isolation.test.ts:123` cria os DOIS fixtures
 * como `role: 'owner'` e compara tenant A contra tenant B: ele prova isolamento ENTRE tenants e
 * é cego para tudo que acontece DENTRO de um. Foi por isso que estes dois passaram anos abertos.
 *
 * Aqui os atores são um `professional` e um `reception` de verdade, logados com o próprio JWT —
 * é a única forma de exercitar a porta lateral do PostgREST, que é onde o defeito morava.
 *
 * **Reintroduzir para conferir** (regra do CLAUDE.md): trocar qualquer política da 0075 de volta
 * por `for all ... has_tenant` deixa o caso correspondente vermelho. O CI (job "Banco e RLS")
 * aplica as migrations do zero a cada execução.
 *
 * A régua da 0075 é o `rbac.ts`, não `can_see_ticket` — reusar aquela função liberaria `reception`,
 * que não tem `commission:*` nem `payment:*`. Por isso o caso da recepção existe abaixo.
 */

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Ator = { email: string; senha: string; userId: string; professionalId?: string }

let tenantId: string
let clientId: string
let comissaoDaAna: string
let comissaoDaBia: string
let pagamentoId: string
const ana = {} as Ator // professional
const bia = {} as Ator // professional
const rita = {} as Ator // reception
const criados: string[] = []

function exigir<T extends { id?: string }>(
  r: { data: T | null; error: { message: string } | null },
  onde: string,
): T & { id: string } {
  if (r.error) throw new Error(`seed falhou em ${onde}: ${r.error.message}`)
  if (!r.data?.id) throw new Error(`seed em ${onde} não devolveu id`)
  return r.data as T & { id: string }
}

async function criarAtor(nome: string, papel: string, alvo: Ator, comProfissional: boolean): Promise<void> {
  const marca = randomUUID().slice(0, 8)
  alvo.email = `rls-papel-${nome}-${marca}@ciclo.test`
  alvo.senha = randomUUID()

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: alvo.email,
    password: alvo.senha,
    email_confirm: true,
  })
  if (userError || !userData.user) throw new Error(`seed falhou ao criar ${nome}: ${userError?.message}`)
  alvo.userId = userData.user.id
  criados.push(alvo.userId)

  exigir(
    await admin.from('memberships').insert({ tenant_id: tenantId, user_id: alvo.userId, role: papel }).select('id').single(),
    `memberships ${nome}`,
  )

  if (comProfissional) {
    alvo.professionalId = exigir(
      await admin
        .from('professionals')
        /*
         * `rent_cents` entra com valor NÃO-ZERO de propósito. A primeira versão deste fixture
         * deixava o default (0) e o caso "não zera o próprio aluguel" passava trivialmente: ele
         * comparava 0 com 0 e teria ficado verde com o defeito inteiro de volta. Teste que afirma
         * um valor precisa que o valor tenha como ser diferente.
         */
        .insert({
          tenant_id: tenantId,
          user_id: alvo.userId,
          display_name: `Profa ${nome}`,
          commission_bps: 3000,
          rent_cents: 50000,
        })
        .select('id')
        .single(),
      `professionals ${nome}`,
    ).id
  }
}

async function entrar(a: Ator): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInWithPassword({ email: a.email, password: a.senha })
  if (error) throw new Error(`não consegui autenticar ${a.email}: ${error.message}`)
  return c
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  tenantId = exigir(
    await admin
      .from('tenants')
      .insert({ name: `RLS papel ${marca}`, slug: `rls-papel-${marca}`, vertical: 'barber' })
      .select('id')
      .single(),
    'tenants',
  ).id

  await criarAtor('ana', 'professional', ana, true)
  await criarAtor('bia', 'professional', bia, true)
  await criarAtor('rita', 'reception', rita, false)

  clientId = exigir(
    await admin.from('clients').insert({ tenant_id: tenantId, name: 'Cliente da prova' }).select('id').single(),
    'clients',
  ).id

  const periodo = { period_start: '2026-09-01', period_end: '2026-09-30' }
  comissaoDaAna = exigir(
    await admin
      .from('commissions')
      .insert({ tenant_id: tenantId, professional_id: ana.professionalId!, base_cents: 20000, bps: 3000, amount_cents: 6000, ...periodo })
      .select('id')
      .single(),
    'commissions ana',
  ).id
  comissaoDaBia = exigir(
    await admin
      .from('commissions')
      .insert({ tenant_id: tenantId, professional_id: bia.professionalId!, base_cents: 50000, bps: 3000, amount_cents: 15000, ...periodo })
      .select('id')
      .single(),
    'commissions bia',
  ).id

  pagamentoId = exigir(
    await admin
      .from('payments')
      // `kind` e `method` são NOT NULL (0001:384-385); os valores saem dos enums `payment_kind` e
      // `payment_method`, conferidos no banco.
      .insert({ tenant_id: tenantId, client_id: clientId, amount_cents: 20000, kind: 'service', method: 'cash' })
      .select('id')
      .single(),
    'payments',
  ).id
}, 180_000)

afterAll(async () => {
  await admin.from('tenants').delete().eq('id', tenantId)
  for (const id of criados) await admin.auth.admin.deleteUser(id)
}, 120_000)

describe('0075 · o profissional não edita o próprio cadastro pela porta lateral', () => {
  it('NÃO consegue aumentar a própria comissão', async () => {
    const c = await entrar(ana)
    await c.from('professionals').update({ commission_bps: 10000 }).eq('id', ana.professionalId!)

    // Asserção sobre o ESTADO, não sobre o erro: sob RLS um UPDATE sem linha permitida devolve
    // sucesso com zero linhas afetadas. Perguntar só pelo `error` deixaria passar o defeito.
    const { data } = await admin.from('professionals').select('commission_bps').eq('id', ana.professionalId!).single()
    expect(data?.commission_bps, 'a comissão foi reescrita pelo próprio profissional').toBe(3000)
  })

  it('NÃO consegue zerar o próprio aluguel de cadeira', async () => {
    const c = await entrar(ana)
    await c.from('professionals').update({ rent_cents: 0 }).eq('id', ana.professionalId!)

    // O fixture nasce com 50000 justamente para este caso poder falhar. Ver o comentário em
    // `criarAtor`: com o default 0, a asserção comparava 0 com 0 e passava com o defeito de volta.
    const { data } = await admin.from('professionals').select('rent_cents').eq('id', ana.professionalId!).single()
    expect(Number(data?.rent_cents ?? -1), 'o aluguel foi zerado pelo próprio profissional').toBe(50000)
  })

  it('NÃO consegue se vincular ao registro de outro profissional', async () => {
    const c = await entrar(ana)
    await c.from('professionals').update({ user_id: ana.userId }).eq('id', bia.professionalId!)
    const { data } = await admin.from('professionals').select('user_id').eq('id', bia.professionalId!).single()
    expect(data?.user_id, 'a Ana se vinculou ao registro da Bia').toBe(bia.userId)
  })

  it('mas CONTINUA lendo a lista de profissionais — a agenda depende disso', async () => {
    const c = await entrar(ana)
    const { data, error } = await c.from('professionals').select('id').eq('tenant_id', tenantId)
    expect(error).toBeNull()
    expect((data ?? []).length, 'a leitura foi apertada junto e a agenda perdeu o seletor').toBeGreaterThanOrEqual(2)
  })
})

describe('0075 · o extrato de um profissional não é público na equipe', () => {
  it('a Bia NÃO enxerga a comissão da Ana', async () => {
    const c = await entrar(bia)
    const { data, error } = await c.from('commissions').select('id, amount_cents').eq('id', comissaoDaAna)
    if (!error) expect(data ?? []).toEqual([])
  })

  it('a Ana continua enxergando a PRÓPRIA comissão (commission:own do rbac.ts)', async () => {
    const c = await entrar(ana)
    const { data, error } = await c.from('commissions').select('id').eq('id', comissaoDaAna)
    expect(error).toBeNull()
    expect((data ?? []).map((r) => r.id)).toEqual([comissaoDaAna])
  })

  it('a recepção não alcança comissão nenhuma — ela não tem `commission:*`', async () => {
    /*
     * O caso que separa esta migration da 0073: reusar `can_see_ticket` teria liberado a
     * recepção, porque `can_see_appointment` a inclui. O `rbac.ts` não dá `commission:*` a ela.
     */
    const c = await entrar(rita)
    const { data, error } = await c.from('commissions').select('id').in('id', [comissaoDaAna, comissaoDaBia])
    if (!error) expect(data ?? []).toEqual([])
  })

  it('a recepção também não lê pagamentos — `payment:*` é de owner e finance', async () => {
    const c = await entrar(rita)
    const { data, error } = await c.from('payments').select('id, amount_cents').eq('id', pagamentoId)
    if (!error) expect(data ?? []).toEqual([])
  })

  it('e o profissional não lê pagamentos, que não são dele nem por `own`', async () => {
    const c = await entrar(ana)
    const { data, error } = await c.from('payments').select('id').eq('id', pagamentoId)
    if (!error) expect(data ?? []).toEqual([])
  })
})
