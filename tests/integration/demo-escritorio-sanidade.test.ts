import { execFileSync } from 'node:child_process'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { beforeAll, describe, expect, it } from 'vitest'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

/**
 * docs/101 anexo 05 §8 (T5b.1): o escritório-modelo é a primeira coisa que um advogado vê, e um seed
 * que "parece certo" pode ser absurdo no agregado (memórias `seed-parece-certo-e-absurdo-no-agregado`
 * e `seed-volume-sai-do-historico`). Este teste RODA o gerador e mede o resultado no banco.
 *
 * Cada asserção nasceu de um absurdo visto na tela durante a construção: pendência aberta há 241 dias,
 * 35 de 63 atrasadas, a mesma família com duas "Holding Alves".
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const admin = createClient<Database>(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

let T: string
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const dias = (de: string) => Math.round((Date.parse(hoje) - Date.parse(de)) / 86_400_000)

beforeAll(() => {
  execFileSync(process.execPath, ['scripts/seed-demo-escritorio.mjs'], { stdio: 'pipe', env: { ...process.env, SEED_SENHA: `t-${Date.now()}` } })
}, 240_000)

beforeAll(async () => {
  const t = await admin.from('tenants').select('id').eq('slug', 'demo-alvorada-advocacia').single()
  if (!t.data) throw new Error('o gerador terminou e o tenant demo não existe')
  T = t.data.id
})

describe('o escritório-modelo, medido depois de gerado', () => {
  it('tem o volume declarado no anexo 06', async () => {
    const conta = async (tabela: 'clients' | 'legal_cases' | 'legal_intimations') =>
      (await admin.from(tabela).select('*', { count: 'exact', head: true }).eq('tenant_id', T)).count
    expect(await conta('clients')).toBe(30)
    expect(await conta('legal_cases')).toBe(55)
    expect(await conta('legal_intimations')).toBeGreaterThan(60)
  })

  it('a fila de pendências parece a de um escritório de verdade', async () => {
    const { data } = await admin
      .from('legal_checklist_items')
      .select('rodada_desde, due_on, status')
      .eq('tenant_id', T)
      .in('status', ['pendente', 'devolvido', 'recebido', 'em_conferencia'])
    const abertas = data ?? []
    expect(abertas.length, 'a fila precisa ter o que mostrar').toBeGreaterThan(20)
    const idades = abertas.map((i) => dias(i.rodada_desde)).sort((a, b) => a - b)
    expect(idades[Math.floor(idades.length / 2)], 'mediana de dias em aberto').toBeLessThanOrEqual(20)
    expect(idades.at(-1), 'a pendência mais antiga (240 dias denunciava o sorteio)').toBeLessThanOrEqual(90)
    const atrasadas = abertas.filter((i) => i.due_on && i.due_on < hoje && ['pendente', 'devolvido'].includes(i.status)).length
    expect(atrasadas / abertas.length, 'fração atrasada').toBeLessThan(0.6)
  })

  it('nenhum cliente com dois casos do mesmo tipo', async () => {
    const { data } = await admin.from('legal_cases').select('client_id, kind').eq('tenant_id', T)
    const vistos = new Set<string>()
    const repetidos = (data ?? []).filter((c) => {
      const k = `${c.client_id}:${c.kind}`
      if (vistos.has(k)) return true
      vistos.add(k)
      return false
    })
    expect(repetidos).toEqual([])
  })

  it('a inconsistência plantada existe e é UMA: uma empresa somando 110%', async () => {
    const { data } = await admin.from('legal_ownerships').select('owned_entity_id, percent').eq('tenant_id', T).is('valid_to', null)
    const soma = new Map<string, number>()
    for (const o of data ?? []) soma.set(o.owned_entity_id, (soma.get(o.owned_entity_id) ?? 0) + Number(o.percent))
    expect([...soma.values()].filter((v) => v > 100)).toEqual([110])
    expect([...soma.values()].filter((v) => v < 100)).toEqual([])
  })

  it('nada parece dado real: texto marcado, sem partes, processo de origem inexistente', async () => {
    const { data } = await admin.from('legal_intimations').select('texto_sanitizado, destinatarios, numero_processo').eq('tenant_id', T)
    for (const i of data ?? []) {
      expect(i.texto_sanitizado).toContain('Exemplo fictício')
      expect(i.destinatarios).toEqual([])
      expect(i.numero_processo.endsWith('9999'), i.numero_processo).toBe(true)
    }
    const empresas = await admin.from('legal_entities').select('legal_name').eq('tenant_id', T)
    expect((empresas.data ?? []).every((e) => e.legal_name.includes('(exemplo)'))).toBe(true)
  })

  it('o cenário 1 está montado: intimação de ontem, ligada a um caso, com prazo sugerido esperando confirmação', async () => {
    const { data } = await admin
      .from('legal_intimations')
      .select('id, case_id, status, legal_intimation_suggestions(suggested_due_on, internal_due_on)')
      .eq('tenant_id', T)
      // vinculada e sem triagem: ligada ao caso, prazo ainda por decidir (a 0109 proíbe "nova" com caso)
      .eq('status', 'vinculada')
      .is('triaged_by', null)
    const comSugestao = (data ?? []).filter((i) => i.legal_intimation_suggestions.some((s) => s.suggested_due_on !== null))
    expect(comSugestao.length).toBeGreaterThan(0)
  })

  it('intimação sem triagem é coisa da última semana, não de meses', async () => {
    const { data } = await admin.from('legal_intimations').select('data_disponibilizacao').eq('tenant_id', T).eq('status', 'nova')
    expect((data ?? []).length).toBeGreaterThan(0)
    for (const i of data ?? []) expect(dias(i.data_disponibilizacao), i.data_disponibilizacao).toBeLessThanOrEqual(10)
  })

  it('a memória de cálculo só lista feriado que caiu em dia útil (domingo não é "pulado")', async () => {
    const { data } = await admin.from('legal_intimation_suggestions').select('calc_memo').eq('tenant_id', T).not('calc_memo', 'is', null)
    expect((data ?? []).length).toBeGreaterThan(0)
    for (const s of data ?? []) {
      const memo = s.calc_memo as { pulados?: string[]; publicado_em?: string; vence_em?: string }
      // o formato é o do núcleo (`sugerirPrazo`): a tela de triagem só lê estas chaves
      expect(memo.publicado_em).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(memo.vence_em).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      for (const p of memo.pulados ?? []) expect([0, 6], p).not.toContain(new Date(`${p.slice(0, 10)}T12:00:00Z`).getUTCDay())
    }
  })

  it('caso encerrado não tem prazo aberto, e família com holding não tem divórcio', async () => {
    const abertos = await admin.from('legal_deadlines').select('legal_cases!legal_deadlines_case_id_tenant_id_fkey!inner(status)').eq('tenant_id', T).eq('status', 'aberto')
    const linhas = (abertos.data ?? []) as unknown as { legal_cases: { status: string } }[]
    expect(linhas.length).toBeGreaterThan(0)
    expect(linhas.filter((l) => ['concluido', 'arquivado'].includes(l.legal_cases.status))).toEqual([])
    const comHolding = await admin.from('legal_entities').select('client_id').eq('tenant_id', T).eq('kind', 'holding_patrimonial')
    const ids = [...new Set((comHolding.data ?? []).map((e) => e.client_id))]
    expect(ids.length).toBe(4)
    const divorcios = await admin.from('legal_cases').select('id').eq('tenant_id', T).eq('kind', 'divorcio_partilha').in('client_id', ids)
    expect(divorcios.data ?? []).toEqual([])
  })

  it('o pico de 15 intimações num dia existe, e nenhum dia passa dele', async () => {
    const { data } = await admin.from('legal_intimations').select('data_disponibilizacao').eq('tenant_id', T)
    const porDia = new Map<string, number>()
    for (const i of data ?? []) porDia.set(i.data_disponibilizacao, (porDia.get(i.data_disponibilizacao) ?? 0) + 1)
    expect(Math.max(...porDia.values())).toBe(15)
  })
})
