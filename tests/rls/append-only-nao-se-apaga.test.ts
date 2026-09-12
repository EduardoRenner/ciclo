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

/**
 * 0085 · O terceiro lote do mesmo aperto seguro: dez tabelas param de aceitar DELETE.
 *
 * "Morta" não foi estabelecido por leitura tabela a tabela — é assim que se erra. Foi pelo lado
 * contrário: enumerando os **17 `.delete()` do `src/` inteiro** e atribuindo cada um à sua tabela.
 * Quem aparece nessa lista ficou de fora do lote.
 *
 * A contagem importou mais que a leitura: 17 no total, 16 atribuídos. O que faltava era
 * `lgpd.ts:296`, `db.from(tabela).delete()` num laço sobre `TABELAS_APAGADAS` — nome de tabela
 * dinâmico, invisível para qualquer grep por literal. É por lá que `client_notes` é apagada, e por
 * isso ela entra neste lote com a justificativa CERTA: morta para o cliente da sessão, viva para o
 * erase, que é service_role.
 *
 * Exercita três das dez. As outras sete são a mesma política, escrita igual, e o custo de montar
 * linha em cada uma não compra confiança proporcional — o que compra é o controle positivo logo
 * abaixo, que prova que este arnês distingue apagou de não apagou.
 */
describe('0085 · a base de clientes, as notas e o histórico de mensagens não se apagam', () => {
  let clienteId: string
  let notaId: string
  let mensagemId: string

  beforeAll(async () => {
    const cliente = exigir(
      await admin.from('clients').insert({ tenant_id: tenantId, name: 'Cliente da 0085' }).select('id').single(),
      'clients',
    )
    clienteId = cliente.id

    const nota = exigir(
      await admin.from('client_notes').insert({ tenant_id: tenantId, client_id: clienteId, body: 'prefere café sem açúcar' }).select('id').single(),
      'client_notes',
    )
    notaId = nota.id

    const msg = exigir(
      await admin.from('messages').insert({ tenant_id: tenantId, client_id: clienteId, kind: 'reminder', channel: 'whatsapp' }).select('id').single(),
      'messages',
    )
    mensagemId = msg.id
  }, 60_000)

  it('o membro LÊ e ATUALIZA a ficha do cliente (a tela inteira depende das duas)', async () => {
    const c = await entrar()
    const { data: lidos } = await c.from('clients').select('id').eq('id', clienteId)
    expect((lidos ?? []).length).toBe(1)

    const upd = await c.from('clients').update({ name: 'Nome Editado' }).eq('id', clienteId).select('id')
    expect(upd.error, upd.error?.message).toBeNull()
  })

  it('o membro ARQUIVA o cliente por `deleted_at`, que é como o app apaga', async () => {
    // A inviolável nº 11 vira RLS: o caminho certo continua aberto, o atalho destrutivo fecha.
    const c = await entrar()
    await c.from('clients').update({ deleted_at: new Date().toISOString() }).eq('id', clienteId)
    const { data } = await admin.from('clients').select('deleted_at').eq('id', clienteId).single()
    expect(data!.deleted_at, 'o soft delete parou de funcionar: arquivar cliente quebraria').toBeTruthy()
  })

  /*
    Os dois casos destrutivos de `clients` ficam POR ÚLTIMO, e cada um usa a própria linha.

    Não é organização: com a política permissiva (ou seja, quando a guarda está fazendo o trabalho
    dela), o delete PASSA e cascateia — `client_notes` e `messages` do mesmo cliente vão junto. Na
    primeira versão deste bloco, o caso de apagar a ficha derrubava a fixture dos dois casos
    seguintes, que reprovavam com `23503` (violação de chave estrangeira) em vez da mensagem que
    explica o problema. Guarda que falha pela razão errada custa o tempo de quem for consertar.
  */
  it('client_notes: o membro escreve e lê, mas não apaga', async () => {
    const c = await entrar()
    const ins = await c.from('client_notes').insert({ tenant_id: tenantId, client_id: clienteId, body: 'nota nova' }).select('id')
    expect(ins.error, ins.error?.message).toBeNull()

    await c.from('client_notes').delete().eq('id', notaId)
    const { count } = await admin.from('client_notes').select('id', { count: 'exact', head: true }).eq('id', notaId)
    expect(count, 'a nota some pelo PostgREST — o erase da LGPD apaga por service_role, não por aqui').toBe(1)
  })

  it('messages: o histórico de envio não se apaga (é a prova do que saiu para quem)', async () => {
    const c = await entrar()
    await c.from('messages').delete().eq('id', mensagemId)
    const { count } = await admin.from('messages').select('id', { count: 'exact', head: true }).eq('id', mensagemId)
    expect(count, 'apagar mensagem enviada destrói a resposta de "essa cliente foi avisada?"').toBe(1)
  })

  it('o membro NÃO apaga a ficha do cliente de verdade', async () => {
    const alvo = exigir(
      await admin.from('clients').insert({ tenant_id: tenantId, name: 'Alvo do delete' }).select('id').single(),
      'clients alvo',
    )
    const c = await entrar()
    await c.from('clients').delete().eq('id', alvo.id)
    const { count } = await admin.from('clients').select('id', { count: 'exact', head: true }).eq('id', alvo.id)
    expect(count, 'a base de clientes é apagável pelo PostgREST — e o produto promete que ela é do salão').toBe(1)
  })

  it('o membro NÃO apaga a base inteira num comando só', async () => {
    /*
      O caso que justifica o lote sozinho: `delete().eq('tenant_id', ...)` é o caminho mais curto
      entre uma credencial de recepção vazada e um salão sem clientela. Medido em 2026-09-10, com a
      política `clients_tenant_all` ainda viva: a base INTEIRA do tenant saiu numa chamada.

      Por último de propósito — é o único caso do arquivo que, quando reprova, leva junto todo o
      resto dos dados do tenant.
    */
    const c = await entrar()
    await c.from('clients').delete().eq('tenant_id', tenantId)
    const { count } = await admin.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    expect(count, 'a base INTEIRA do salão saiu num comando').toBeGreaterThan(0)
  })
})

/**
 * 0086 · O DELETE passa a exigir o mesmo papel que a rota já exige.
 *
 * As duas migrations anteriores tiraram capacidade MORTA — aperto sem risco. Esta mexe em
 * capacidade VIVA, e por isso a guarda precisa provar os DOIS lados:
 *
 *   - quem a rota recusa também é recusado pela RLS (senão o atalho continua aberto);
 *   - **quem a rota autoriza continua passando** — e este é o lado que, se quebrar, quebra calado.
 *     `delete` barrado por RLS devolve "sucesso, zero linhas", não erro: o dono clicaria em
 *     "remover folga", veria sucesso, e a folga continuaria lá.
 *
 * A régua não foi escolhida, foi derivada do mapa rota → `exigirPermissao` do próprio produto:
 * `time-off/[id]` exige `professional:update`, que em `rbac.ts` só o `owner` tem (o `manager` tem
 * `professional:read`); `message-templates/[id]` exige `client:update`, que owner e manager têm.
 */
describe('0086 · o DELETE segue o papel que a rota exige', () => {
  let donoEmail: string
  let gerenteEmail: string
  const senhaComum = randomUUID()

  async function entrarComo(mail: string): Promise<SupabaseClient> {
    const c = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await c.auth.signInWithPassword({ email: mail, password: senhaComum })
    if (error) throw new Error(`autenticar ${mail}: ${error.message}`)
    return c
  }

  async function criarMembro(papel: 'owner' | 'manager'): Promise<string> {
    const mail = `rls-${papel}-${randomUUID().slice(0, 8)}@ciclo.test`
    const { data, error } = await admin.auth.admin.createUser({ email: mail, password: senhaComum, email_confirm: true })
    if (error || !data.user) throw new Error(`criar ${papel}: ${error?.message}`)
    userIds.push(data.user.id)
    const { error: erroM } = await admin.from('memberships').insert({ tenant_id: tenantId, user_id: data.user.id, role: papel })
    if (erroM) throw new Error(`membership ${papel}: ${erroM.message}`)
    return mail
  }

  async function novaFolga(): Promise<string> {
    const inicio = new Date(Date.now() + 86_400_000).toISOString()
    const fim = new Date(Date.now() + 90_000_000).toISOString()
    return exigir(
      await admin.from('time_off').insert({ tenant_id: tenantId, starts_at: inicio, ends_at: fim }).select('id').single(),
      'time_off',
    ).id
  }

  async function novoModelo(): Promise<string> {
    return exigir(
      await admin
        .from('message_templates')
        .insert({ tenant_id: tenantId, slug: `modelo-${randomUUID().slice(0, 8)}`, title: 'Lembrete', body: 'Oi!' })
        .select('id')
        .single(),
      'message_templates',
    ).id
  }

  async function existe(tabela: 'time_off' | 'message_templates', id: string): Promise<number> {
    const { count } = await admin.from(tabela).select('id', { count: 'exact', head: true }).eq('id', id)
    return count ?? 0
  }

  beforeAll(async () => {
    donoEmail = await criarMembro('owner')
    gerenteEmail = await criarMembro('manager')
  }, 60_000)

  it('time_off · o PROFISSIONAL não apaga folga (a rota exige professional:update)', async () => {
    const id = await novaFolga()
    const c = await entrar()
    await c.from('time_off').delete().eq('id', id)
    expect(await existe('time_off', id), 'o profissional apagou folga pelo PostgREST — a rota recusaria').toBe(1)
  })

  it('time_off · o GERENTE também não (rbac dá a ele professional:read, não :update)', async () => {
    // O caso mais afiado do arquivo: é ele que prova que eu li a matriz de papéis certo. Se o
    // manager passar, a régua ficou mais frouxa que a rota e a RLS não está protegendo nada novo.
    const id = await novaFolga()
    const c = await entrarComo(gerenteEmail)
    await c.from('time_off').delete().eq('id', id)
    expect(await existe('time_off', id), 'o gerente apagou folga, mas a rota `time-off/[id]` o recusa').toBe(1)
  })

  it('time_off · o DONO apaga — e é este lado que quebraria calado', async () => {
    const id = await novaFolga()
    const c = await entrarComo(donoEmail)
    await c.from('time_off').delete().eq('id', id)
    expect(
      await existe('time_off', id),
      'o DONO deixou de conseguir remover folga. Pela RLS isso volta como "sucesso, zero linhas": ' +
        'a tela diria que removeu e a folga continuaria na agenda.',
    ).toBe(0)
  })

  it('message_templates · o profissional não apaga modelo', async () => {
    const id = await novoModelo()
    const c = await entrar()
    await c.from('message_templates').delete().eq('id', id)
    expect(await existe('message_templates', id)).toBe(1)
  })

  it('message_templates · o GERENTE apaga (aqui a rota exige client:update, que ele tem)', async () => {
    // O par do caso do gerente acima: a régua distingue as duas tabelas, em vez de apertar tudo
    // para owner e chamar isso de segurança. Apertar demais também quebra, e quebra calado.
    const id = await novoModelo()
    const c = await entrarComo(gerenteEmail)
    await c.from('message_templates').delete().eq('id', id)
    expect(await existe('message_templates', id), 'o gerente perdeu o direito de remover modelo de mensagem').toBe(0)
  })

  async function novaFoto(): Promise<string> {
    return exigir(
      await admin.from('media').insert({ tenant_id: tenantId, storage_key: `k/${randomUUID()}`, kind: 'photo' }).select('id').single(),
      'media',
    ).id
  }

  it('media · o profissional não apaga (no app, remover foto é soft delete)', async () => {
    const id = await novaFoto()
    const c = await entrar()
    await c.from('media').delete().eq('id', id)
    const { count } = await admin.from('media').select('id', { count: 'exact', head: true }).eq('id', id)
    expect(count, 'o profissional apagou mídia pelo PostgREST').toBe(1)
  })

  it('media · o DONO apaga — e este caso existe porque a primeira versão da 0086 o quebrou', async () => {
    /*
      Registro de um erro meu, mantido como caso porque é o tipo que volta.

      A 0086 original tirou o DELETE de `media` inteiro, com o raciocínio de "capacidade morta": no
      app remover foto é soft delete, e o erase roda por service_role. Certo sobre produção, errado
      sobre o produto — `tests/integration/lgpd.test.ts` guarda de propósito a propriedade de que
      `eliminarCliente` funciona mesmo chamado FORA da rota, com um cliente de sessão, e reprovou.

      O conserto foi na migration, não no teste: a régua espelha a rota, e a rota do erase exige
      `client:delete` (owner + manager). Este caso é o que impede a versão errada de voltar.
    */
    const id = await novaFoto()
    const c = await entrarComo(donoEmail)
    await c.from('media').delete().eq('id', id)
    const { count } = await admin.from('media').select('id', { count: 'exact', head: true }).eq('id', id)
    expect(count, 'o dono deixou de apagar mídia: o erase chamado fora da rota volta a falhar calado').toBe(0)
  })

  it('client_notes · mesma lista do erase, mesma régua: profissional não, dono sim', async () => {
    // `client_notes` está em `TABELAS_APAGADAS` junto com `media`. A 0085 a deixou sem DELETE
    // nenhum e NENHUM teste cobria esse caminho — teria quebrado em silêncio.
    const criar = async () =>
      exigir(
        await admin.from('client_notes').insert({ tenant_id: tenantId, client_id: cicloClientId, body: 'nota' }).select('id').single(),
        'client_notes',
      ).id

    const doProfissional = await criar()
    const prof = await entrar()
    await prof.from('client_notes').delete().eq('id', doProfissional)
    const { count: sobrou } = await admin.from('client_notes').select('id', { count: 'exact', head: true }).eq('id', doProfissional)
    expect(sobrou, 'o profissional apagou nota de cliente').toBe(1)

    const doDono = await criar()
    const dono = await entrarComo(donoEmail)
    await dono.from('client_notes').delete().eq('id', doDono)
    const { count: foi } = await admin.from('client_notes').select('id', { count: 'exact', head: true }).eq('id', doDono)
    expect(foi, 'o dono deixou de apagar nota: o erase fora da rota falharia calado').toBe(0)
  })
})
