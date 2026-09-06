import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { diaMaisOciosoDoTenant } from '@/server/services/ociosidade'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de ociosidade precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
/**
 * Quinta-feira fixa, nunca `new Date()`: o teste tem que dar o mesmo resultado hoje e daqui a um
 * ano. `docs/53` D-01 — as datas abaixo foram calculadas a mão a partir desta âncora (ver o
 * comentário de cada bloco de seed).
 */
const HOJE = '2026-09-10'

const tenants: string[] = []
const usuarios: string[] = []
let tenantId: string
let professionalId: string
let servicoId: string

async function marcar(dataISO: string, status: 'done' | 'confirmed') {
  const { error } = await svc.from('appointments').insert({
    tenant_id: tenantId,
    professional_id: professionalId,
    service_id: servicoId,
    starts_at: `${dataISO}T10:00:00-03:00`,
    ends_at: `${dataISO}T10:30:00-03:00`,
    status,
    price_cents: 5_000,
  })
  if (error) throw new Error(`seed de agendamento em ${dataISO} falhou: ${error.message}`)
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `ociosidade-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dono da Ociosidade' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Ociosidade',
    vertical: 'nails',
    slug: `ociosidade-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Profissional de Teste',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Serviço de Teste',
    description: null,
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 5_000,
    pricingModel: 'fixed',
    cycleDays: 21,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  servicoId = servico.id

  /*
   * Âncora HOJE = 2026-09-10 (quinta). As terças das últimas 8 ocorrências, da mais recente
   * para a mais antiga: 08/09, 01/09, 25/08, 18/08, 11/08, 04/08, 28/07, 21/07 — calculado à mão
   * fora do algoritmo, para o teste não validar o código com o próprio código.
   *
   * Terça: vazia nas 5 mais recentes, ocupada nas 3 mais antigas — streak esperado 5, de 8
   * observadas. Qualifica (streak ≥ 3, observadas ≥ 4).
   */
  await marcar('2026-08-04', 'done')
  await marcar('2026-07-28', 'done')
  await marcar('2026-07-21', 'done')

  /*
   * Quinta: as últimas 8 ocorrências antes de hoje são 03/09, 27/08, 20/08, 13/08, 06/08, 30/07,
   * 23/07, 16/07 — todas ocupadas. Streak esperado 0. Não qualifica, e serve de controle: prova
   * que o dia cheio nunca aparece como "o pior", mesmo tendo o mesmo tanto de histórico da terça.
   */
  for (const data of ['2026-09-03', '2026-08-27', '2026-08-20', '2026-08-13', '2026-08-06', '2026-07-30', '2026-07-23', '2026-07-16']) {
    await marcar(data, 'confirmed')
  }

  /*
   * O expediente padrão do pack é seg-sáb (`0002_vertical_packs.sql`): segunda, quarta, sexta e
   * sábado TAMBÉM entram na conta de `diaMaisOciosoDoTenant`, e sem nenhum agendamento eles
   * ficariam 100% vazios — streak 8, maior que o da terça, e o teste apontaria o dia errado. A
   * primeira versão deste teste caiu exatamente nisso, pego pela CI (`docs/DECISOES.md`): todo
   * dia que o salão abre precisa de um controle "cheio" tão explícito quanto a quinta.
   */
  const CHEIOS: Record<number, string[]> = {
    1: ['2026-09-07', '2026-08-31', '2026-08-24', '2026-08-17', '2026-08-10', '2026-08-03', '2026-07-27', '2026-07-20'],
    3: ['2026-09-09', '2026-09-02', '2026-08-26', '2026-08-19', '2026-08-12', '2026-08-05', '2026-07-29', '2026-07-22'],
    5: ['2026-09-04', '2026-08-28', '2026-08-21', '2026-08-14', '2026-08-07', '2026-07-31', '2026-07-24', '2026-07-17'],
    6: ['2026-09-05', '2026-08-29', '2026-08-22', '2026-08-15', '2026-08-08', '2026-08-01', '2026-07-25', '2026-07-18'],
  }
  for (const datas of Object.values(CHEIOS)) {
    for (const data of datas) await marcar(data, 'confirmed')
  }
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('diaMaisOciosoDoTenant', () => {
  it('aponta a terça — vazia nas 5 semanas mais recentes, de um total de 8 observadas', async () => {
    const pior = await diaMaisOciosoDoTenant(svc, tenantId, TZ, HOJE)
    expect(pior).toEqual({ weekday: 2, semanasSeguidasVazias: 5, semanasObservadas: 8 })
  })

  it('a quinta, cheia todo esse tempo, nunca aparece como a pior — mesmo com o mesmo histórico', async () => {
    const pior = await diaMaisOciosoDoTenant(svc, tenantId, TZ, HOJE)
    expect(pior?.weekday).not.toBe(4)
  })

  it('domingo (fechado neste salão, expediente seg-sáb) nunca entra na conta', async () => {
    const pior = await diaMaisOciosoDoTenant(svc, tenantId, TZ, HOJE)
    // Nunca aponta um dia sem expediente cadastrado, mesmo que ele literalmente nunca tenha
    // atendimento — "fechado" e "vazio" são fatos diferentes (mesma distinção de `listarAgendaDoDia`).
    expect(pior?.weekday).not.toBe(0)
  })
})
