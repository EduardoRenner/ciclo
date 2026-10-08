import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { capturarIntimacoesDoEscritorio } from '@/server/advocacia/captura'

import type { FetchLike } from '@/server/advocacia/djen'
import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

/**
 * docs/101 T4.1: a captura de ponta a ponta contra o banco, com um DJEN FALSO (o teste nunca bate na
 * API real). Prova a correção da 0113: antes dela a RPC lia `texto` e o núcleo manda
 * `texto_sanitizado`, e nenhuma intimação gravava.
 */
const BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL!
const admin = createClient<Database>(BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

const OAB = String(90000 + Math.floor(Math.random() * 9999))
const PROCESSO = `0001234562026824${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`
const OUTRO = `0009999992026824${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`
const HOJE = '2026-10-08'
let T: string
let caseId: string
let djen = Math.floor(Math.random() * 1e9) + 5e9

const item = (processo: string, texto: string, oab = OAB) => ({
  id: ++djen,
  data_disponibilizacao: '2026-10-07',
  siglaTribunal: 'TJSC',
  tipoComunicacao: 'Intimação',
  nomeOrgao: 'Vara de exemplo',
  texto,
  numero_processo: processo,
  hash: `h${djen}`,
  status: 'P',
  motivo_cancelamento: null,
  data_cancelamento: null,
  destinatarios: [{ nome: 'PARTE EXEMPLO', polo: 'A' }],
  destinatarioadvogados: [{ advogado: { nome: 'ADVOGADA EXEMPLO DE TAL', numero_oab: oab, uf_oab: 'SC' } }],
})

/** O DJEN do teste: dia 06 cai (HTTP 500) na primeira rodada; dia 07 tem 2 do alvo + 1 de outra OAB; dia 08 vazio. */
function djenFalso(itensDo07: unknown[], falhar06: { vezes: number }): FetchLike {
  return async (url) => {
    const dia = new URL(url).searchParams.get('dataDisponibilizacaoInicio')
    if (dia === '2026-10-06' && falhar06.vezes-- > 0) return { ok: false, status: 500, json: async () => ({}) }
    const items = dia === '2026-10-07' ? itensDo07 : []
    return { ok: true, status: 200, json: async () => ({ status: 'success', count: items.length, items }) }
  }
}

beforeAll(async () => {
  const prof = await admin.from('professions').select('id').eq('slug', 'advocacia').single()
  const t = await admin
    .from('tenants')
    .insert({ name: 'Captura', slug: `int-cap-${randomUUID().slice(0, 8)}`, vertical: 'general', profession_id: prof.data!.id, settings: { advocacia: { regras_confirmadas: ['unidade-civel'] } } })
    .select('id')
    .single()
  T = t.data!.id
  const cliente = await admin.from('clients').insert({ tenant_id: T, name: 'Cliente da captura' }).select('id').single()
  await admin.from('professionals').insert({ tenant_id: T, display_name: 'Advocacia', legal_role: 'advogado', oab_number: OAB, oab_uf: 'SC' })
  caseId = (
    await admin.from('legal_cases').insert({ tenant_id: T, client_id: cliente.data!.id, kind: 'civel', title: 'Ação', client_title: 'o seu processo', cnj_number: PROCESSO, rito: 'civel' }).select('id').single()
  ).data!.id
}, 60_000)

afterAll(async () => {
  await admin.from('tenants').delete().eq('id', T)
})

describe('captura de intimações', () => {
  const doDia07 = [
    item(PROCESSO, 'Fica a parte intimada para manifestar-se no prazo de 15 (quinze) dias úteis. Exemplo fictício.'),
    item(OUTRO, 'Ato ordinatório: vista dos autos. Exemplo fictício.'),
    // o DJEN às vezes ignora o filtro: item de OUTRA OAB não pode entrar
    item(OUTRO, 'Intimação de outra advocacia. Exemplo fictício.', '11111'),
  ]
  const falhar06 = { vezes: 1 }

  it('grava as do alvo, liga ao caso pelo número, sugere o prazo e marca o dia que falhou', async () => {
    const r = await capturarIntimacoesDoEscritorio(admin, T, HOJE, { fetchImpl: djenFalso(doDia07, falhar06) })
    expect(r).toMatchObject({ alvos: 1, dias: 3, novas: 2, falhas: 1 })

    const intim = await admin
      .from('legal_intimations')
      .select('numero_processo, status, case_id, texto_sanitizado, legal_intimation_suggestions!legal_intimation_suggestions_intimation_id_tenant_id_fkey(suggested_due_on, sem_sugestao)')
      .eq('tenant_id', T)
      .order('numero_processo')
    const linhas = intim.data ?? []
    expect(linhas).toHaveLength(2)
    const doCaso = linhas.find((l) => l.numero_processo === PROCESSO)!
    expect(doCaso).toMatchObject({ status: 'vinculada', case_id: caseId })
    expect(doCaso.texto_sanitizado).toContain('15 (quinze)')
    expect(doCaso.legal_intimation_suggestions[0]?.suggested_due_on).toMatch(/^2026-10-\d\d$/)
    const semCaso = linhas.find((l) => l.numero_processo === OUTRO)!
    expect(semCaso).toMatchObject({ status: 'nova', case_id: null })
    expect(semCaso.legal_intimation_suggestions[0]?.sem_sugestao).toContain('vincule')

    const sync = await admin.from('legal_intimation_sync').select('dia, ok, count_fonte, count_gravado, detalhe').eq('tenant_id', T).order('dia')
    expect(sync.data).toEqual([
      { dia: '2026-10-06', ok: false, count_fonte: 0, count_gravado: 0, detalhe: expect.stringContaining('http') },
      // 3 vieram, 1 era de outro alvo: o dia NÃO fecha verde (o banco confere a recusa)
      { dia: '2026-10-07', ok: false, count_fonte: 3, count_gravado: 2, detalhe: expect.stringContaining('de_outro_alvo') },
      { dia: '2026-10-08', ok: true, count_fonte: 0, count_gravado: 0, detalhe: null },
    ])
  })

  it('a segunda rodada refaz o dia que caiu e não duplica o que já gravou', async () => {
    const r = await capturarIntimacoesDoEscritorio(admin, T, HOJE, { fetchImpl: djenFalso(doDia07, falhar06) })
    expect(r.falhas).toBe(0)
    expect(r.novas).toBe(0)
    const total = await admin.from('legal_intimations').select('id', { count: 'exact', head: true }).eq('tenant_id', T)
    expect(total.count).toBe(2)
    const sugestoes = await admin.from('legal_intimation_suggestions').select('id', { count: 'exact', head: true }).eq('tenant_id', T)
    expect(sugestoes.count).toBe(2)
    const dia06 = await admin.from('legal_intimation_sync').select('ok').eq('tenant_id', T).eq('dia', '2026-10-06').single()
    expect(dia06.data!.ok).toBe(true)
  })
})
