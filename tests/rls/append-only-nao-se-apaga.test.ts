import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Mesma regra da pasta: falta de credencial NÃO vira teste verde.
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    'O teste append-only precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e ' +
      'SUPABASE_SERVICE_ROLE_KEY no .env.local.',
  )
}

/**
 * A `0081` recortou `cycle_predictions` e `package_uses` — antes `for all using has_tenant`, que
 * deixa qualquer membro ativo apagar/reescrever pela porta lateral do PostgREST.
 *
 * `cycle_predictions` é append-only por design (`0064`): o Motor grava uma vez, nunca mais muda.
 * `package_uses` é o consumo de sessão de um pacote — desfazer é movimento compensatório, não
 * `DELETE`. As duas escritas do Motor são `service_role` (ignora RLS); o `insert` de
 * `package_uses` continua vindo do cliente do usuário e continua liberado.
 *
 * **Asserção pelo ESTADO via admin, nunca pelo `error`**: sob RLS um `update`/`delete` sem linha
 * permitida devolve **sucesso com zero linhas**. Reintroduzir `for all ... has_tenant` (mutação)
 * deixa os casos de "some" vermelhos — o CI (job "Banco e RLS") aplica do zero.
 */

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

type Linha = { id?: string }
function exigir<T extends Linha>(r: { data: T | null; error: { message: string } | null }, onde: string): T & { id: string } {
  if (r.error) throw new Error(`seed falhou em ${onde}: ${r.error.message}`)
  if (!r.data?.id) throw new Error(`seed em ${onde} não devolveu id`)
  return r.data as T & { id: string }
}

let tenantId: string
let previsaoId: string
let usoId: string
let packageId: string
let cicloClientId: string
let cicloServiceId: string
let pontoId: string
let carteiraId: string
let email: string
let senha: string
const userIds: string[] = []

beforeAll(async () => {
  const m = randomUUID().slice(0, 8)
  tenantId = exigir(
    await admin.from('tenants').insert({ name: `RLS append ${m}`, slug: `rls-append-${m}`, vertical: 'barber' }).select('id').single(),
    'tenants',
  ).id

  email = `rls-append-${m}@ciclo.test`
  senha = randomUUID()
  const { data: u, error: eu } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (eu || !u.user) throw new Error(`seed usuário: ${eu?.message}`)
  userIds.push(u.user.id)
  exigir(
    await admin.from('memberships').insert({ tenant_id: tenantId, user_id: u.user.id, role: 'professional' }).select('id').single(),
    'memberships',
  )

  const clientId = exigir(await admin.from('clients').insert({ tenant_id: tenantId, name: 'Cliente' }).select('id').single(), 'clients').id
  const serviceId = exigir(
    await admin.from('services').insert({ tenant_id: tenantId, name: 'Corte', duration_min: 30, price_cents: 5000 }).select('id').single(),
    'services',
  ).id
  cicloClientId = clientId
  cicloServiceId = serviceId

  previsaoId = exigir(
    await admin
      .from('cycle_predictions')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        service_id: serviceId,
        last_visit_on: '2026-08-01',
        predicted_on: '2026-08-22',
        personal_cycle_days: 21,
        default_cycle_days: 21,
        algo_version: 1,
      })
      .select('id')
      .single(),
    'cycle_predictions',
  ).id

  packageId = exigir(
    await admin
      .from('packages')
      .insert({ tenant_id: tenantId, client_id: clientId, service_id: serviceId, total_sessions: 5, paid_cents: 20000 })
      .select('id')
      .single(),
    'packages',
  ).id
  usoId = exigir(
    await admin.from('package_uses').insert({ tenant_id: tenantId, package_id: packageId }).select('id').single(),
    'package_uses',
  ).id

  // 0082
  if (
    (await admin.from('client_cycles').insert({ tenant_id: tenantId, client_id: clientId, service_id: serviceId, personal_cycle_days: 21 }))
      .error
  ) {
    throw new Error('seed client_cycles falhou')
  }
  if ((await admin.from('loyalty_entries').insert({ tenant_id: tenantId, client_id: clientId, points: 100, reason: 'seed' })).error) {
    throw new Error('seed loyalty_entries falhou')
  }
  pontoId = exigir(
    await admin
      .from('loyalty_entries')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('reason', 'seed')
      .single(),
    'loyalty_entries id',
  ).id
  if (
    (
      await admin.from('monthly_profit').insert({
        tenant_id: tenantId,
        month: '2026-08-01',
        revenue_cents: 100000,
        material_cents: 10000,
        fee_cents: 2000,
        commission_cents: 30000,
        profit_cents: 58000,
        tickets_count: 12,
      })
    ).error
  ) {
    throw new Error('seed monthly_profit falhou')
  }

  // 0083 — `5000`, e não `0`: o teste do UPDATE compara o valor DEPOIS com este número. Com zero,
  // um `update({ amount_cents: 0 })` barrado e um permitido dariam o mesmo "0 vs 0" (o quase-erro
  // da 0075). O fixture precisa poder falhar.
  carteiraId = exigir(
    await admin
      .from('wallet_entries')
      .insert({ tenant_id: tenantId, client_id: clientId, amount_cents: 5000, reason: 'seed: sinal virado crédito' })
      .select('id')
      .single(),
    'wallet_entries',
  ).id
}, 180_000)

afterAll(async () => {
  await admin.from('tenants').delete().eq('id', tenantId)
  for (const id of userIds) await admin.auth.admin.deleteUser(id)
}, 120_000)

async function entrar(): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: senha })
  if (error) throw new Error(`autenticar: ${error.message}`)
  return c
}

describe('0081 · cycle_predictions e package_uses não se apagam pela porta lateral', () => {
  it('o membro LÊ a previsão (a tela de prestação de contas depende disso)', async () => {
    const c = await entrar()
    const { data } = await c.from('cycle_predictions').select('id').eq('id', previsaoId)
    expect((data ?? []).map((r) => r.id)).toEqual([previsaoId])
  })

  it('o membro NÃO reescreve a previsão (append-only)', async () => {
    const c = await entrar()
    await c.from('cycle_predictions').update({ predicted_on: '2030-01-01' }).eq('id', previsaoId)
    const { data } = await admin.from('cycle_predictions').select('predicted_on').eq('id', previsaoId).single()
    expect(data!.predicted_on).toBe('2026-08-22')
  })

  it('o membro NÃO apaga a previsão', async () => {
    const c = await entrar()
    await c.from('cycle_predictions').delete().eq('id', previsaoId)
    const { count } = await admin.from('cycle_predictions').select('id', { count: 'exact', head: true }).eq('id', previsaoId)
    expect(count).toBe(1)
  })

  it('o membro LÊ e INSERE package_uses (o consumo de sessão vem do cliente do usuário)', async () => {
    const c = await entrar()
    const leitura = await c.from('package_uses').select('id').eq('id', usoId)
    expect((leitura.data ?? []).map((r) => r.id)).toEqual([usoId])

    const insercao = await c.from('package_uses').insert({ tenant_id: tenantId, package_id: packageId }).select('id').single()
    expect(insercao.error, insercao.error?.message).toBeNull()
    expect(insercao.data?.id).toBeTruthy()
  })

  it('o membro NÃO apaga um consumo de sessão (desfazer é compensação, não DELETE)', async () => {
    const c = await entrar()
    await c.from('package_uses').delete().eq('id', usoId)
    const { count } = await admin.from('package_uses').select('id', { count: 'exact', head: true }).eq('id', usoId)
    expect(count).toBe(1)
  })
})

describe('0082 · client_cycles, loyalty_entries e monthly_profit param de aceitar DELETE', () => {
  it('client_cycles: UPDATE ainda funciona (o Motor faz upsert pelo cliente do usuário ao concluir atendimento)', async () => {
    const c = await entrar()
    const r = await c
      .from('client_cycles')
      .update({ late_days: 3 })
      .eq('tenant_id', tenantId)
      .eq('client_id', cicloClientId)
      .eq('service_id', cicloServiceId)
      .select('late_days')
    expect(r.error, r.error?.message).toBeNull()
    expect(r.data?.[0]?.late_days).toBe(3)
  })

  it('client_cycles: DELETE não passa', async () => {
    const c = await entrar()
    await c.from('client_cycles').delete().eq('tenant_id', tenantId).eq('client_id', cicloClientId)
    const { count } = await admin
      .from('client_cycles')
      .select('client_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('client_id', cicloClientId)
    expect(count).toBe(1)
  })

  it('loyalty_entries: INSERT funciona (lançar ponto), UPDATE e DELETE não', async () => {
    const c = await entrar()
    const ins = await c.from('loyalty_entries').insert({ tenant_id: tenantId, client_id: cicloClientId, points: -50, reason: 'resgate' }).select('id').single()
    expect(ins.error, ins.error?.message).toBeNull()

    await c.from('loyalty_entries').update({ points: 9999 }).eq('id', pontoId)
    await c.from('loyalty_entries').delete().eq('id', pontoId)
    const { data } = await admin.from('loyalty_entries').select('points').eq('id', pontoId).single()
    expect(data!.points).toBe(100) // nem editado, nem apagado
  })

  it('monthly_profit: UPDATE e DELETE não passam (append-only da 0071)', async () => {
    const c = await entrar()
    await c.from('monthly_profit').update({ profit_cents: 1 }).eq('tenant_id', tenantId).eq('month', '2026-08-01')
    await c.from('monthly_profit').delete().eq('tenant_id', tenantId).eq('month', '2026-08-01')
    const { data } = await admin.from('monthly_profit').select('profit_cents').eq('tenant_id', tenantId).eq('month', '2026-08-01').single()
    expect(data!.profit_cents).toBe(58000)
  })
})

/**
 * CONTROLE POSITIVO — o caso que prova que todos os "NÃO apaga" acima sabem falhar.
 *
 * Os casos de negação afirmam que o estado NÃO mudou. Um arnês quebrado — sessão que não
 * autenticou, `entrar()` devolvendo cliente anônimo, filtro que não casa linha nenhuma — produz
 * exatamente o mesmo resultado: nada muda, tudo verde. É a "guarda que passa vazia" do CLAUDE.md,
 * e num arquivo inteiro de asserções negativas ela é a falha mais provável.
 *
 * `waitlist` continua com o `waitlist_tenant_all` do loop da `0001` (`for all using has_tenant`) —
 * o `docs/57` a lista em "deixar como está, de propósito", config compartilhada do salão. Então o
 * MESMO membro, pelo MESMO caminho, TEM que conseguir apagar aqui. Se este caso ficar verde
 * dizendo "não apagou", o arnês está cego e nenhuma negação deste arquivo vale nada.
 *
 * Isto substitui a mutação (afrouxar a 0083 para vê-la reprovar) com uma vantagem: a mutação é
 * uma observação única, feita uma vez por quem escreveu; o controle roda em toda CI, para sempre.
 */
describe('controle positivo · o arnês sabe detectar política permissiva', () => {
  it('na waitlist, que segue em `for all`, o MESMO membro apaga de verdade', async () => {
    const linha = exigir(
      await admin
        .from('waitlist')
        .insert({ tenant_id: tenantId, client_id: cicloClientId, service_id: cicloServiceId })
        .select('id')
        .single(),
      'waitlist',
    )

    const antes = await admin.from('waitlist').select('id', { count: 'exact', head: true }).eq('id', linha.id)
    expect(antes.count, 'o seed da waitlist não entrou — o controle não provaria nada').toBe(1)

    const c = await entrar()
    await c.from('waitlist').delete().eq('id', linha.id)

    const depois = await admin.from('waitlist').select('id', { count: 'exact', head: true }).eq('id', linha.id)
    expect(
      depois.count,
      'o membro NÃO conseguiu apagar de uma tabela `for all` — o arnês está cego (sessão que não ' +
        'autenticou, filtro que não casa), e então todos os casos de "não apaga" deste arquivo ' +
        'estão passando vazios.',
    ).toBe(0)
  })
})

/**
 * A carteira é a que mais importa das seis, e foi a que ficou de fora da 0080/0081/0082: o saldo
 * é `sum(amount_cents)`, então apagar uma linha MOVE DINHEIRO — apagar débito ressuscita crédito
 * já gasto, apagar crédito evapora o que a cliente pagou. E some sem rastro, porque o rastro era
 * a linha.
 */
describe('0083 · a carteira da cliente é livro-razão: entra linha, nada sai', () => {
  it('o membro LÊ o extrato (o saldo na comanda depende disso)', async () => {
    const c = await entrar()
    const { data } = await c.from('wallet_entries').select('id').eq('id', carteiraId)
    expect((data ?? []).map((r) => r.id)).toEqual([carteiraId])
  })

  it('o membro INSERE crédito (cortesia e sinal virado crédito vêm do cliente do usuário)', async () => {
    const c = await entrar()
    const ins = await c
      .from('wallet_entries')
      .insert({ tenant_id: tenantId, client_id: cicloClientId, amount_cents: 1500, reason: 'cortesia' })
      .select('id')
      .single()
    expect(ins.error, ins.error?.message).toBeNull()
    expect(ins.data?.id).toBeTruthy()
  })

  it('o membro NÃO imprime dinheiro reescrevendo o valor de uma linha', async () => {
    const c = await entrar()
    await c.from('wallet_entries').update({ amount_cents: 999_999 }).eq('id', carteiraId)
    const { data } = await admin.from('wallet_entries').select('amount_cents').eq('id', carteiraId).single()
    expect(data!.amount_cents).toBe(5000)
  })

  it('o membro NÃO apaga uma linha do extrato', async () => {
    const c = await entrar()
    await c.from('wallet_entries').delete().eq('id', carteiraId)
    const { count } = await admin.from('wallet_entries').select('id', { count: 'exact', head: true }).eq('id', carteiraId)
    expect(count).toBe(1)
  })

  it('e não apaga em lote pelo client_id, que é como se limpa um extrato inteiro', async () => {
    const contar = async () =>
      (
        await admin
          .from('wallet_entries')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('client_id', cicloClientId)
      ).count

    // Conta ANTES em vez de cravar um número: assim o caso não depende de quais `it` rodaram
    // antes dele. O piso garante que não está afirmando sobre um extrato vazio.
    const antes = await contar()
    expect(antes ?? 0, 'o extrato do fixture está vazio — o caso não provaria nada').toBeGreaterThan(0)

    const c = await entrar()
    await c.from('wallet_entries').delete().eq('tenant_id', tenantId).eq('client_id', cicloClientId)

    expect(await contar()).toBe(antes)
  })
})

/**
 * 0084 · A migration que a `0080` deixou registrada como pendente, com o motivo:
 *
 *   "`health_records` é o exemplo vivo: o erase da LGPD apaga a ficha de saúde com o cliente do
 *    USUÁRIO, então apertar ali às cegas transformaria 'direito ao esquecimento' em
 *    `rowsRemoved: 0` com HTTP 200. Fica registrado para quando houver banco de dev para verificar."
 *
 * O passo de código saiu em 2026-09-09 (o erase passou a rodar por `withTenant`), e este bloco é a
 * verificação que faltava: o último caso prova que o erase AINDA apaga depois do aperto. Sem ele,
 * esta migration seria exatamente o desastre que a `0080` descreveu — e ele falharia calado.
 */
describe('0084 · ficha de saúde e consentimento não se apagam pelo PostgREST', () => {
  let saudeId: string
  let consentId: string
  let saudeDoErase: string

  beforeAll(async () => {
    const ficha = exigir(
      await admin
        .from('health_records')
        .insert({ tenant_id: tenantId, client_id: cicloClientId, form_key: 'anamnese', ciphertext: '\x0102', iv: '\x03', auth_tag: '\x04' })
        .select('id')
        .single(),
      'health_records',
    )
    saudeId = ficha.id

    const outra = exigir(
      await admin
        .from('health_records')
        .insert({ tenant_id: tenantId, client_id: cicloClientId, form_key: 'para-o-erase', ciphertext: '\x0102', iv: '\x03', auth_tag: '\x04' })
        .select('id')
        .single(),
      'health_records do erase',
    )
    saudeDoErase = outra.id

    const consentimento = exigir(
      await admin
        .from('consents')
        .insert({ tenant_id: tenantId, client_id: cicloClientId, kind: 'image_use', version: '1', text_hash: 'abc', granted: true })
        .select('id')
        .single(),
      'consents',
    )
    consentId = consentimento.id
  }, 60_000)

  it('o membro LÊ a linha da ficha (o alerta na tela do cliente depende disso)', async () => {
    // Só o metadado: a `0077` já tirou `ciphertext`/`iv`/`auth_tag` do grant de `authenticated`.
    const c = await entrar()
    const { data } = await c.from('health_records').select('id').eq('id', saudeId)
    expect((data ?? []).map((r) => r.id)).toEqual([saudeId])
  })

  it('o membro ESCREVE a anamnese (o upsert de `anamnese.ts` vem do cliente do usuário)', async () => {
    const c = await entrar()
    const upd = await c.from('health_records').update({ has_alert: true }).eq('id', saudeId).select('id')
    expect(upd.error, upd.error?.message).toBeNull()
    const { data } = await admin.from('health_records').select('has_alert').eq('id', saudeId).single()
    expect(data!.has_alert, 'o UPDATE parou de passar: editar ficha existente quebraria').toBe(true)
  })

  it('o membro NÃO apaga a ficha de saúde', async () => {
    const c = await entrar()
    await c.from('health_records').delete().eq('id', saudeId)
    const { count } = await admin.from('health_records').select('id', { count: 'exact', head: true }).eq('id', saudeId)
    expect(count, 'dado de saúde apagável por qualquer membro pelo PostgREST').toBe(1)
  })

  it('e não apaga em lote pelo client_id, que é como se limpa a ficha inteira', async () => {
    const c = await entrar()
    await c.from('health_records').delete().eq('tenant_id', tenantId).eq('client_id', cicloClientId)
    const { count } = await admin
      .from('health_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('client_id', cicloClientId)
    expect(count, 'o DELETE em lote passou — é o caminho mais curto para destruir dado de saúde').toBeGreaterThan(0)
  })

  it('o membro LÊ, INSERE e REVOGA consentimento (as três são caminho de app)', async () => {
    const c = await entrar()
    const { data: lidos } = await c.from('consents').select('id').eq('id', consentId)
    expect((lidos ?? []).length, 'a ficha do cliente monta a seção de consentimentos com isto').toBe(1)

    const ins = await c
      .from('consents')
      .insert({ tenant_id: tenantId, client_id: cicloClientId, kind: 'image_use', version: '2', text_hash: 'def', granted: true })
      .select('id')
      .single()
    expect(ins.error, ins.error?.message).toBeNull()

    // Revogar é UPDATE, nunca DELETE — a linha revogada continua sendo a prova.
    await c.from('consents').update({ revoked_at: new Date().toISOString() }).eq('id', consentId)
    const { data } = await admin.from('consents').select('revoked_at').eq('id', consentId).single()
    expect(data!.revoked_at, 'revogar parou de funcionar: o titular perde o direito de retirar o consentimento').toBeTruthy()
  })

  it('o membro NÃO apaga o registro de consentimento', async () => {
    const c = await entrar()
    await c.from('consents').delete().eq('id', consentId)
    const { count } = await admin.from('consents').select('id', { count: 'exact', head: true }).eq('id', consentId)
    expect(count, 'apagar consentimento destrói a prova de que ele existiu — é o oposto do que a LGPD pede').toBe(1)
  })

  it('O ERASE CONTINUA APAGANDO — a verificação que a 0080 deixou pendente', async () => {
    /*
      Este caso é a razão de a migration poder existir. `eliminarCliente` roda por `withTenant`
      (rota de erase) e `withNovoTenant` (cron de retenção) — os dois service_role, que é o que
      `admin` representa aqui. Se este caso ficar vermelho, o direito ao esquecimento virou
      `rowsRemoved: 0` com HTTP 200, exatamente o desastre descrito na `0080`.
    */
    const { error } = await admin.from('health_records').delete().eq('id', saudeDoErase)
    expect(error, error?.message).toBeNull()
    const { count } = await admin.from('health_records').select('id', { count: 'exact', head: true }).eq('id', saudeDoErase)
    expect(count, 'o service_role deixou de apagar a ficha: o erase da LGPD está quebrado').toBe(0)
  })
})
