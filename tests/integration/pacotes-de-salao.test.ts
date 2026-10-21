import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import { SERVICO_DE_VOLTA } from '@/core/cycle/servico-padrao-da-base'
import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('O teste dos pacotes precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

type Item = { name: string; price_cents: number; duration_min: number; cycle_days: number }

const BELEZA = ['nails', 'lashes', 'brows', 'hair', 'waxing', 'aesthetics'] as const

/**
 * Os nomes de antes da 0146. `canonical_key` é `pack:<vertical>:<nome>` (0097) e liga cada serviço das
 * contas antigas ao agregado e ao `SERVICO_DE_VOLTA`: renomear um item quebraria esse vínculo sem
 * erro nenhum. Por isso a revisão só ACRESCENTA e reordena.
 */
const NOMES_DE_ANTES: Record<(typeof BELEZA)[number], string[]> = {
  nails: ['Esmaltação em gel', 'Alongamento em fibra', 'Manutenção de alongamento', 'Banho de gel', 'Manicure simples', 'Pedicure', 'Remoção'],
  lashes: ['Aplicação volume russo', 'Manutenção volume russo', 'Aplicação híbrida', 'Aplicação clássica', 'Lash lifting + botox', 'Remoção'],
  brows: ['Design com henna', 'Design simples', 'Brow lamination', 'Micropigmentação', 'Retoque de micro'],
  hair: ['Corte feminino', 'Corte masculino', 'Escova', 'Hidratação', 'Coloração / retoque de raiz', 'Mechas / luzes', 'Progressiva', 'Penteado'],
  waxing: ['Perna inteira', 'Virilha completa', 'Axila', 'Buço', 'Combo perna + virilha + axila'],
  aesthetics: ['Limpeza de pele profunda', 'Peeling químico', 'Microagulhamento', 'Drenagem linfática', 'Massagem modeladora'],
}

async function pacote(vertical: string): Promise<Item[]> {
  const { data, error } = await svc.from('vertical_packs').select('services').eq('vertical', vertical as never).single()
  if (error) throw error
  return data.services as unknown as Item[]
}

const paraLimpar: string[] = []
afterAll(async () => {
  if (paraLimpar.length) await svc.from('tenants').delete().in('id', paraLimpar)
})

/**
 * docs/112 EXP-S06 (migration 0146, `04-salao.md` §4): o catálogo pronto de salão tinha o que mais se
 * vende faltando (pé e mão, alongamento em gel, manutenção de fio a fio, meia perna), corte masculino
 * em 2º e tudo com `position = 0`: a página pública abria por "Aplicação volume russo" e mostrava
 * "Remoção" para a cliente marcar.
 */
describe('catálogo pronto de salão (docs/112 EXP-S06)', () => {
  it.each(BELEZA)('%s: nenhum nome antigo sumiu, o serviço sem retorno vem por último', async (vertical) => {
    const itens = await pacote(vertical)
    const nomes = itens.map((i) => i.name)
    expect(new Set(nomes).size).toBe(nomes.length)
    for (const antigo of NOMES_DE_ANTES[vertical]) expect(nomes, `${antigo} sumiu (quebra o canonical_key)`).toContain(antigo)
    const primeiroSemRetorno = itens.findIndex((i) => i.cycle_days < 1)
    if (primeiroSemRetorno !== -1) expect(itens.slice(primeiroSemRetorno).every((i) => i.cycle_days < 1)).toBe(true)
    expect(itens[0]!.cycle_days, `${vertical} abre por um serviço sem retorno`).toBeGreaterThan(0)
    const deVolta = itens.filter((i) => SERVICO_DE_VOLTA.has(`pack:${vertical}:${i.name}`)).map((i) => i.name)
    if (deVolta.length) expect(nomes[0], `${vertical} não abre pelo serviço de volta`).toBe(deVolta[0])
  })

  it('o que faltava entrou, com os preços do §4', async () => {
    const [unhas, cilios, sobrancelha, cabelo, depilacao] = await Promise.all(['nails', 'lashes', 'brows', 'hair', 'waxing'].map(pacote))
    const achar = (itens: Item[], nome: string) => itens.find((i) => i.name === nome)
    expect(unhas![0]).toMatchObject({ name: 'Pé e mão', price_cents: 7500, duration_min: 90, cycle_days: 14 })
    expect(achar(unhas!, 'Alongamento em gel')).toMatchObject({ price_cents: 17000, cycle_days: 21 })
    expect(achar(unhas!, 'Blindagem')).toBeTruthy()
    expect(achar(unhas!, 'Manicure simples')?.cycle_days).toBe(14)
    expect(achar(cilios!, 'Manutenção fio a fio')).toMatchObject({ cycle_days: 21 })
    expect(achar(sobrancelha!, 'Brow lamination')?.price_cents).toBe(11000)
    expect(achar(depilacao!, 'Perna inteira')?.price_cents).toBe(9000)
    expect(achar(depilacao!, 'Meia perna')).toMatchObject({ price_cents: 5000, duration_min: 30, cycle_days: 28 })
    const comRetorno = cabelo!.filter((i) => i.cycle_days > 0).map((i) => i.name)
    expect(comRetorno.at(-1), 'corte masculino vai para o fim da lista').toBe('Corte masculino')
  })

  it('conta nova recebe os serviços na ordem do pacote (position)', async () => {
    const { data: tenant, error } = await svc
      .from('tenants')
      .insert({ name: 'Esmalteria do Teste', slug: `pacote-ordem-${randomUUID().slice(0, 8)}`, vertical: 'nails', timezone: 'America/Sao_Paulo' })
      .select('id')
      .single()
    if (error) throw error
    paraLimpar.push(tenant.id)
    const { error: erroPack } = await svc.rpc('apply_vertical_pack', { p_tenant: tenant.id, p_vertical: 'nails' })
    if (erroPack) throw erroPack

    const { data: servicos } = await svc.from('services').select('name, position').eq('tenant_id', tenant.id).order('position').order('name')
    expect(servicos!.map((s) => s.name)).toEqual((await pacote('nails')).map((i) => i.name))
    expect(new Set(servicos!.map((s) => s.position)).size, 'position empatada: a página volta a ordenar pelo banco').toBe(servicos!.length)
  })
})
