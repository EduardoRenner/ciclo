import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { CATALOGO, CONDICAO_DE_PACOTE_PARA_GUARDA, PLANOS, podeUsarModulo, type ContextoDoTenant, type ModuloKey, type Veredito } from '@/core/billing/planos'
import { PACOTES } from '@/core/pacotes'

/**
 * docs/101 T0.2: a quarta camada de `podeUsarModulo` (pacote, antes do eixo).
 *
 * O teste mais importante aqui é o primeiro: o veredito de TODOS os módulos para um tenant de
 * beleza, escrito por literal, como era ANTES da camada existir. Se a ordem das camadas mudar, ou
 * se um módulo de pacote vazar para a base, isto reprova; nenhum outro teste do projeto olha o
 * conjunto inteiro de uma vez.
 */

/** Barbearia no Grátis, sem pacote declarado (como todo chamador anterior à 0101 monta o contexto). */
const BARBEARIA_GRATIS: ContextoDoTenant = {
  plano: 'gratis',
  eixos: { onde: 'no_local', cobranca: 'fixo', inicio: 'direto', ritmo: 'avulso' },
}

const VEREDITOS_DE_ANTES: Record<ModuloKey, Veredito> = {
  agenda: { estado: 'liberado' },
  cycle_engine: { estado: 'liberado' },
  public_page: { estado: 'liberado' },
  clients: { estado: 'liberado' },
  reminders: { estado: 'liberado' },
  recurrence: { estado: 'fora_do_eixo', eixo: 'ritmo' },
  quotes: { estado: 'fora_do_eixo', eixo: 'inicio' },
  routing: { estado: 'fora_do_eixo', eixo: 'onde' },
  register: { estado: 'bloqueado_pelo_plano', precisaDo: 'essencial' },
  stock: { estado: 'bloqueado_pelo_plano', precisaDo: 'essencial' },
  loyalty: { estado: 'bloqueado_pelo_plano', precisaDo: 'essencial' },
  club: { estado: 'bloqueado_pelo_plano', precisaDo: 'essencial' },
  campaigns: { estado: 'bloqueado_pelo_plano', precisaDo: 'essencial' },
  team: { estado: 'bloqueado_pelo_plano', precisaDo: 'essencial' },
  health_records: { estado: 'bloqueado_pelo_plano', precisaDo: 'essencial' },
  documents: { estado: 'bloqueado_pelo_plano', precisaDo: 'essencial' },
  assistant: { estado: 'liberado' },
  // Os cinco novos: para beleza, somem. Nem "bloqueado", nem "fora do eixo": fora do pacote.
  legal_cases: { estado: 'fora_do_pacote', pacote: 'base' },
  legal_checklists: { estado: 'fora_do_pacote', pacote: 'base' },
  legal_structure: { estado: 'fora_do_pacote', pacote: 'base' },
  legal_deadlines: { estado: 'fora_do_pacote', pacote: 'base' },
  legal_documents: { estado: 'fora_do_pacote', pacote: 'base' },
}

const LEGAIS: readonly ModuloKey[] = ['legal_cases', 'legal_checklists', 'legal_structure', 'legal_deadlines', 'legal_documents']

describe('o tenant de beleza recebe exatamente os vereditos de antes', () => {
  it('todos os 22 módulos, por literal, sem pacote declarado', () => {
    const vereditos = Object.fromEntries(CATALOGO.map((m) => [m.key, podeUsarModulo(BARBEARIA_GRATIS, m.key)]))
    expect(vereditos).toEqual(VEREDITOS_DE_ANTES)
  })

  it('declarar pacote base dá o mesmo resultado que não declarar', () => {
    for (const m of CATALOGO) {
      expect(podeUsarModulo({ ...BARBEARIA_GRATIS, pacote: 'base' }, m.key)).toEqual(podeUsarModulo(BARBEARIA_GRATIS, m.key))
    }
  })

  it('o pacote vem ANTES do plano: um salão no Grátis nunca vê "Casos bloqueado, assine"', () => {
    // Se o plano viesse primeiro, este seria `bloqueado_pelo_plano` com oferta de upgrade.
    expect(podeUsarModulo(BARBEARIA_GRATIS, 'legal_cases').estado).toBe('fora_do_pacote')
  })
})

describe('o escritório recebe os módulos do pacote', () => {
  const ESCRITORIO = (plano: ContextoDoTenant['plano']): ContextoDoTenant => ({
    plano,
    pacote: 'advocacia',
    eixos: { onde: 'hibrido', cobranca: 'orcamento', inicio: 'solicitacao', ritmo: 'sob_demanda' },
  })

  it('no Solo (essencial), os cinco são liberados', () => {
    for (const k of LEGAIS) expect(podeUsarModulo(ESCRITORIO('essencial'), k)).toEqual({ estado: 'liberado' })
  })

  it('no Grátis, são bloqueados pelo plano com o Solo como caminho (não somem)', () => {
    for (const k of LEGAIS) expect(podeUsarModulo(ESCRITORIO('gratis'), k)).toEqual({ estado: 'bloqueado_pelo_plano', precisaDo: 'essencial' })
  })

  it('o dono do escritório pode desligar qualquer um dos cinco', () => {
    const ctx = { ...ESCRITORIO('essencial'), desligadosPeloDono: ['legal_structure' as const] }
    expect(podeUsarModulo(ctx, 'legal_structure')).toEqual({ estado: 'desligado_pelo_dono' })
    expect(podeUsarModulo(ctx, 'legal_cases')).toEqual({ estado: 'liberado' })
  })

  it('o resto do catálogo continua valendo para o escritório pelas regras de sempre', () => {
    // `inicio = 'solicitacao'` não é `orcamento_antes`: Orçamento some pelo eixo, como em qualquer negócio.
    expect(podeUsarModulo(ESCRITORIO('essencial'), 'quotes')).toEqual({ estado: 'fora_do_eixo', eixo: 'inicio' })
    expect(podeUsarModulo(ESCRITORIO('essencial'), 'agenda')).toEqual({ estado: 'liberado' })
  })
})

describe('as listas não divergem', () => {
  it('todo módulo condicionado a pacote existe no catálogo e aponta para pacote do registro', () => {
    const doCatalogo = new Set(CATALOGO.map((m) => m.key))
    for (const [modulo, pacotes] of Object.entries(CONDICAO_DE_PACOTE_PARA_GUARDA)) {
      expect(doCatalogo.has(modulo as ModuloKey), `${modulo} condicionado e fora do catálogo`).toBe(true)
      for (const p of pacotes ?? []) expect(p in PACOTES, `${modulo} aponta para pacote inexistente "${p}"`).toBe(true)
    }
  })

  it('todo módulo legal_* do catálogo é condicionado a pacote (nenhum vaza para beleza por esquecimento)', () => {
    const legais = CATALOGO.map((m) => m.key).filter((k) => k.startsWith('legal_'))
    expect(legais).toHaveLength(5)
    for (const k of legais) expect(CONDICAO_DE_PACOTE_PARA_GUARDA[k], `${k} sem condição de pacote`).toBeDefined()
  })

  it('os cinco entram no degrau de entrada (essencial), como o docs/101 §3.3 decide', () => {
    for (const k of LEGAIS) expect(PLANOS.essencial.modulos).toContain(k)
    for (const k of LEGAIS) expect(PLANOS.gratis.modulos).not.toContain(k)
  })

  it('os rótulos da 0102 são os do catálogo', () => {
    const sql = readFileSync('supabase/migrations/0102_modulos_do_pacote.sql', 'utf8')
    for (const m of CATALOGO.filter((x) => LEGAIS.includes(x.key))) {
      expect(sql, `rótulo de ${m.key} diverge entre core e 0102`).toContain(`'${m.key}',`)
      expect(sql).toContain(`'${m.label}'`)
    }
  })
})
