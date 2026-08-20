import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { describe, expect, it } from 'vitest'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste do catálogo precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * docs/09-PLATAFORMA.md §5: 3 profissões "profundas" (preço/duração
 * pesquisados, o que se leva pra vender) — barber, faxina, eletricista.
 * Nada na aplicação lê `professions`/`profession_services` ainda (achado
 * registrado em P1/P2), então sem este teste uma migration futura poderia
 * corromper o catálogo (apagar linha, preço negativo, eixo inválido) sem
 * ninguém notar até o dia em que alguma tela passar a consumir.
 */
const PROFUNDAS = ['barber', 'faxina', 'eletricista']

describe('catálogo de profissões (docs/09-PLATAFORMA.md §5)', () => {
  it('tem as 12 profissões do lançamento, sem contar as 5 verticais de beleza que já existiam antes da virada', async () => {
    const { data, error } = await svc.from('professions').select('slug')
    if (error) throw error
    // 8 originais (P0) + 9 novas (P5) = 17. As 12 "do lançamento" citadas no
    // plano são um subconjunto conceitual (barber/nails/hair + as 9 novas);
    // a tabela em si guarda todas.
    expect(data).toHaveLength(17)
  })

  it.each(PROFUNDAS)('%s (profunda) tem pelo menos 4 serviços cadastrados', async (slug) => {
    const { data: prof, error: erroProf } = await svc.from('professions').select('id').eq('slug', slug).single()
    if (erroProf) throw erroProf

    const { data: servicos, error } = await svc.from('profession_services').select('nome, duracao_min, preco_sugerido_cents').eq('profession_id', prof.id)
    if (error) throw error

    expect(servicos!.length).toBeGreaterThanOrEqual(4)
    for (const s of servicos!) {
      // "existir" e "estar pronta pra vender" são coisas diferentes (§5) —
      // preço 0 ou nome genérico ("Serviço 1") são o sintoma exato do que o
      // plano queria evitar.
      expect(s.preco_sugerido_cents, s.nome).toBeGreaterThan(0)
      expect(s.duracao_min, s.nome).toBeGreaterThan(0)
      expect(s.nome).not.toMatch(/^servi[cç]o \d+$/i)
    }
  })

  it('toda profissão tem os 4 eixos preenchidos (docs/09-PLATAFORMA.md §4)', async () => {
    const { data, error } = await svc.from('professions').select('slug, onde, cobranca, inicio, ritmo')
    if (error) throw error
    for (const p of data!) {
      expect(p.onde, p.slug).toBeTruthy()
      expect(p.cobranca, p.slug).toBeTruthy()
      expect(p.inicio, p.slug).toBeTruthy()
      expect(p.ritmo, p.slug).toBeTruthy()
    }
  })

  it('faxina e eletricista realmente cobrem os eixos que o plano prometeu (vai até o cliente)', async () => {
    const { data, error } = await svc.from('professions').select('slug, onde, ritmo, cobranca').in('slug', ['faxina', 'eletricista'])
    if (error) throw error
    const faxina = data!.find((p) => p.slug === 'faxina')!
    const eletricista = data!.find((p) => p.slug === 'eletricista')!

    expect(faxina.onde).toBe('vai_ate')
    expect(faxina.ritmo).toBe('recorrente')
    expect(eletricista.onde).toBe('vai_ate')
    expect(eletricista.cobranca).toBe('visita_hora')
  })

  it('nenhum profession_services órfão — todo profession_id existe em professions', async () => {
    const { data: servicos, error } = await svc.from('profession_services').select('profession_id')
    if (error) throw error
    const { data: profissoes, error: erroProf } = await svc.from('professions').select('id')
    if (erroProf) throw erroProf
    const idsValidos = new Set(profissoes!.map((p) => p.id))
    for (const s of servicos!) {
      expect(idsValidos.has(s.profession_id), s.profession_id).toBe(true)
    }
  })
})
