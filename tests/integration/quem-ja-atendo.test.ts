import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { cadastrarQuemJaAtendo } from '@/server/services/quem-ja-atendo'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Este teste precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * A segunda porta da base: a MEMÓRIA.
 *
 * O #109 consertou a importação por planilha. Planilha é a minoria deste público — barbeiro,
 * manicure e depiladora têm a clientela nos contatos e na cabeça. Para essas pessoas o Motor de
 * Ciclo nascia vazio e continuava vazio por meses: o mesmo defeito do #109, por outro caminho.
 *
 * A cadeia que estes casos exercitam é a inteira, e termina onde a tela lê:
 *
 *   digitar nome + "uns 15 dias"  →  clients.last_visit_at  →  client_cycles
 *                                 →  v_clientes_a_recuperar  →  /admin/hoje
 *
 * Parar no meio (conferir só que o cadastro entrou) é o que deixou o defeito do #109 vivo por tanto
 * tempo: tudo respondia certo e a tela ficava em R$ 0,00.
 */

let tenantId: string
let serviceId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `ja-atendo-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Memória' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Barbearia da Memória',
    vertical: 'barber',
    slug: `ja-atendo-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const { data: servicos } = await svc.from('services').select('id').eq('tenant_id', tenantId).gt('cycle_days', 0).limit(1)
  if (!servicos?.[0]) throw new Error('o onboarding devia ter criado serviços com cycle_days')
  serviceId = servicos[0].id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

function telefoneNovo() {
  return `1198${String(1000000 + Math.floor(Math.random() * 8999999)).padStart(7, '0')}`
}

describe('cadastrar de memória põe a clientela no Motor', () => {
  it(
    'quem sumiu chega até v_clientes_a_recuperar, que é o que a tela Hoje lê',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const r = await cadastrarQuemJaAtendo(svc, tenantId, {
        serviceId,
        pessoas: [{ nome: `Sumida ${marca}`, telefone: telefoneNovo(), quando: 'faz-tempo' }],
      })

      expect(r.cadastrados).toBe(1)
      expect(r.previsao?.jaDevendoVoltar, 'quem não vem há 4 meses tinha que contar como atrasada').toBe(1)
      expect(r.previsao?.cyclesGravados, 'o ciclo não foi persistido — é o defeito do #109 de volta').toBe(1)

      const { data: cliente } = await svc
        .from('clients')
        .select('id, last_visit_at, source')
        .eq('tenant_id', tenantId)
        .eq('name', `Sumida ${marca}`)
        .maybeSingle()
      expect(cliente?.last_visit_at, 'a data de memória não foi gravada em clients').toBeTruthy()
      expect(cliente?.source).toBe('memoria')

      const { data: aRecuperar } = await svc
        .from('v_clientes_a_recuperar')
        .select('client_id')
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente!.id)
      expect(aRecuperar?.length, 'gravou o ciclo mas a pessoa não chega na lista que a tela lê').toBeGreaterThan(0)
    },
    30_000,
  )

  it(
    'PISO — quem veio semana passada NÃO entra na lista (senão o caso acima passaria com tudo)',
    async () => {
      /*
        Sem este caso, o anterior provaria pouco: uma cadeia que jogasse TODO MUNDO na lista de
        recuperação passaria igual, e a tela mostraria o salão inteiro como "sumido". É o mesmo
        cuidado do controle positivo dos testes de RLS — a guarda precisa poder distinguir.
      */
      const marca = randomUUID().slice(0, 6)
      const r = await cadastrarQuemJaAtendo(svc, tenantId, {
        serviceId,
        pessoas: [{ nome: `Recente ${marca}`, telefone: telefoneNovo(), quando: 'semana' }],
      })
      expect(r.previsao?.jaDevendoVoltar, 'quem veio semana passada foi marcada como atrasada').toBe(0)

      const { data: cliente } = await svc
        .from('clients')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', `Recente ${marca}`)
        .maybeSingle()
      const { data: aRecuperar } = await svc
        .from('v_clientes_a_recuperar')
        .select('client_id')
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente!.id)
      expect(aRecuperar?.length ?? 0, 'quem está em dia apareceu como "dá para recuperar"').toBe(0)
    },
    30_000,
  )

  it(
    'telefone repetido não vira ficha duplicada, e volta pelo NOME para a tela poder dizer quem',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const telefone = telefoneNovo()
      await cadastrarQuemJaAtendo(svc, tenantId, { serviceId, pessoas: [{ nome: `Primeira ${marca}`, telefone, quando: 'mes' }] })

      const r = await cadastrarQuemJaAtendo(svc, tenantId, {
        serviceId,
        pessoas: [{ nome: `Repetida ${marca}`, telefone, quando: 'mes' }],
      })
      expect(r.cadastrados).toBe(0)
      expect(r.jaExistiam).toEqual([`Repetida ${marca}`])
    },
    30_000,
  )

  it(
    'sem telefone entra sempre — não há como afirmar que é a mesma pessoa',
    async () => {
      // Duas "Ana" num salão são o caso comum, não a exceção. Recusar por nome esconderia cliente de
      // verdade, e o erro de criar ficha repetida é mais barato (e visível) que o de engolir alguém.
      const marca = randomUUID().slice(0, 6)
      const nome = `Ana ${marca}`
      await cadastrarQuemJaAtendo(svc, tenantId, { serviceId, pessoas: [{ nome, quando: 'mes' }] })
      const r = await cadastrarQuemJaAtendo(svc, tenantId, { serviceId, pessoas: [{ nome, quando: 'mes' }] })

      expect(r.cadastrados).toBe(1)
      expect(r.jaExistiam).toEqual([])
    },
    30_000,
  )
})

/**
 * A terceira porta: `retornos` — cliente que JÁ tem ficha (veio da importação, da memória, ou de
 * atendimento de verdade) e voltou de novo, sem reabrir o cadastro. É o que sustenta o salão que
 * continua operando noutro sistema e usa o CICLO só como camada de recuperação: sem isso, o Motor
 * nascia uma vez e nunca mais era alimentado.
 */
describe('retornos: quem já tem ficha e voltou, sem reabrir o cadastro', () => {
  async function clienteExistente(nome: string) {
    const { data, error } = await svc
      .from('clients')
      .insert({ tenant_id: tenantId, name: nome, source: 'memoria', last_visit_at: '2026-01-01' })
      .select('id')
      .single()
    if (error || !data) throw new Error(`seed de cliente falhou: ${error?.message}`)
    return data.id
  }

  it(
    'atualiza o ciclo de um cliente existente sem criar ficha nova',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const clientId = await clienteExistente(`Voltou ${marca}`)

      const r = await cadastrarQuemJaAtendo(svc, tenantId, {
        serviceId,
        retornos: [{ clientId, quando: 'faz-tempo' }],
      })

      expect(r.cadastrados, 'não deveria criar ficha nova — o cliente já existia').toBe(0)
      expect(r.previsao?.cyclesGravados).toBe(1)

      const { data: clientes } = await svc.from('clients').select('id').eq('tenant_id', tenantId).eq('name', `Voltou ${marca}`)
      expect(clientes?.length, 'virou ficha duplicada em vez de atualizar a existente').toBe(1)

      const { data: ciclo } = await svc.from('client_cycles').select('state').eq('tenant_id', tenantId).eq('client_id', clientId).maybeSingle()
      expect(ciclo?.state).toBe('late')
    },
    30_000,
  )

  it(
    'clientId de outro tenant é ignorado, não gravado — a RLS não é a única linha de defesa',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const { data: outroUsuario } = await svc.auth.admin.createUser({
        email: `outro-tenant-${marca}@ciclo.test`,
        password: randomUUID(),
        email_confirm: true,
      })
      const { tenant: outroTenant } = await executarOnboarding(svc, {
        userId: outroUsuario!.user!.id,
        businessName: 'Outro Salão',
        vertical: 'barber',
        slug: `outro-${marca}`,
        timezone: 'America/Sao_Paulo',
      })
      const { data: clienteDeOutro } = await svc
        .from('clients')
        .insert({ tenant_id: outroTenant.id, name: 'Cliente de outro salão', source: 'memoria', last_visit_at: '2026-01-01' })
        .select('id')
        .single()

      const r = await cadastrarQuemJaAtendo(svc, tenantId, {
        serviceId,
        retornos: [{ clientId: clienteDeOutro!.id, quando: 'semana' }],
      })

      expect(r.previsao, 'gravou ciclo para um cliente de outro tenant').toBeNull()
      const { data: ciclo } = await svc.from('client_cycles').select('id').eq('tenant_id', tenantId).eq('client_id', clienteDeOutro!.id)
      expect(ciclo?.length ?? 0).toBe(0)

      await svc.from('tenants').delete().eq('id', outroTenant.id)
      await svc.auth.admin.deleteUser(outroUsuario!.user!.id)
    },
    30_000,
  )

  it(
    'pessoas e retornos no mesmo envio: os dois contam para o mesmo cálculo',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const clientId = await clienteExistente(`Antiga ${marca}`)

      const r = await cadastrarQuemJaAtendo(svc, tenantId, {
        serviceId,
        pessoas: [{ nome: `Nova ${marca}`, telefone: telefoneNovo(), quando: 'faz-tempo' }],
        retornos: [{ clientId, quando: 'faz-tempo' }],
      })

      expect(r.cadastrados).toBe(1)
      expect(r.previsao?.comDataInformada).toBe(2)
      expect(r.previsao?.cyclesGravados).toBe(2)
    },
    30_000,
  )

  it(
    'clientId repetido no mesmo lote não quebra o upsert — fica só um',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const clientId = await clienteExistente(`Duplicado ${marca}`)

      const r = await cadastrarQuemJaAtendo(svc, tenantId, {
        serviceId,
        retornos: [
          { clientId, quando: 'semana' },
          { clientId, quando: 'faz-tempo' },
        ],
      })

      expect(r.previsao?.cyclesGravados, 'o mesmo cliente duas vezes no lote devia virar uma linha só').toBe(1)
    },
    30_000,
  )
})
