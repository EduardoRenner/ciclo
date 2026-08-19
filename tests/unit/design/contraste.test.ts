import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Lê os tokens do próprio `globals.css`, e não uma cópia: assim mudar uma cor
 * sem olhar o contraste reprova o build, que é o que "contraste AA verificado"
 * do TICKET-013 precisa significar para não virar promessa.
 */
const css = readFileSync('src/app/globals.css', 'utf8')

function token(nome: string): string {
  const achado = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(css)
  if (!achado?.[1]) throw new Error(`token --${nome} não encontrado em globals.css`)
  return achado[1]
}

/** Luminância relativa da WCAG 2.1. */
function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = canais.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number]
  return (claro + 0.05) / (escuro + 0.05)
}

const BG = token('bg')
const SURFACE = token('surface')
const SURFACE_2 = token('surface-2')

describe('contraste dos tokens (WCAG AA)', () => {
  it('a régua confere com um par conhecido', () => {
    // Preto no branco é 21:1. Se esta conta estiver errada, o resto do arquivo
    // não vale nada.
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it.each([
    ['txt', 4.5],
    ['txt-2', 4.5],
    ['txt-3', 4.5],
  ])('--%s tem pelo menos %s:1 sobre o fundo e sobre o card', (nome, minimo) => {
    // §7 pede 4,5:1 para texto. O texto aparece sobre `--bg` e sobre `--surface`,
    // então os dois contam — medir só contra o fundo mais escuro superestima.
    expect(contraste(token(nome), BG), `${nome} sobre --bg`).toBeGreaterThanOrEqual(minimo)
    expect(contraste(token(nome), SURFACE), `${nome} sobre --surface`).toBeGreaterThanOrEqual(minimo)
  })

  it.each(['ok', 'warn', 'risk', 'bad', 'info', 'acc-2'])(
    '--%s serve como texto de selo sobre a superfície',
    (nome) => {
      // Badge/Pill escreve com a cor do estado sobre um fundo dela mesma a 15%,
      // que fica praticamente na cor da superfície.
      expect(contraste(token(nome), SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(contraste(token(nome), SURFACE_2)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('o texto do botão primário (--on-acc) lê sobre --acc e --acc-2', () => {
    // `docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §B1/§6: o botão primário deixou
    // de ser gradiente (`--grad-acc`, removido) e passou a ser --acc sólido. O
    // teste lê --on-acc do próprio CSS em vez de hardcodear o hex, senão ele
    // para de proteger a troca de cor no dia em que --on-acc mudar de novo.
    const onAcc = token('on-acc')
    expect(contraste(onAcc, token('acc'))).toBeGreaterThanOrEqual(4.5)
    expect(contraste(onAcc, token('acc-2'))).toBeGreaterThanOrEqual(4.5)
  })

  describe('separação por luminância entre semânticos (daltonismo verde-vermelho)', () => {
    // Parte II §3.7: em deuteranopia/protanopia (~8% dos homens — público direto
    // de barbearia) só a LUMINÂNCIA separa cores na mesma família (verde↔laranja
    // ↔vermelho). --ok e --bad chegaram a ter Δ0,054 — praticamente a mesma cor
    // para quem não distingue matiz nessa faixa. --info fica de fora deste bloco
    // de propósito: é azul, e azul↔amarelo é o eixo que a maioria dos daltônicos
    // vermelho-verde continua enxergando — não precisa competir por luminância
    // com a família verde/laranja/vermelho.
    const PISO = 0.15

    function luminanciaToken(nome: string): number {
      return luminancia(token(nome))
    }

    it.each([
      ['ok', 'warn'],
      ['ok', 'risk'],
      ['ok', 'bad'],
      ['warn', 'bad'],
      ['risk', 'bad'],
    ])('--%s e --%s têm Δ luminância de pelo menos 0,15', (a, b) => {
      const delta = Math.abs(luminanciaToken(a) - luminanciaToken(b))
      expect(delta, `Δ(--${a}, --${b}) = ${delta.toFixed(3)}`).toBeGreaterThanOrEqual(PISO)
    })
  })

  it('as superfícies não colapsam umas nas outras', () => {
    // Em tema escuro a separação entre fundo e card é sutil de propósito (aqui
    // dá ~1,07:1) e quem desenha a borda do card é `--line`. O que este teste
    // impede é o colapso: um copiar-e-colar que deixe surface igual a bg apaga
    // o card, e a borda sozinha não sustenta a hierarquia.
    expect(new Set([BG, SURFACE, SURFACE_2, token('surface-3')]).size).toBe(4)
    expect(css).toMatch(/--line:\s*rgba/)
  })
})

describe('acento de cada vertical', () => {
  // A tabela de §1 troca --acc por pack. Se um acento novo entrar sem contraste,
  // o botão primário daquela vertical nasce ilegível.
  const ACENTOS: Array<[string, string, string]> = [
    ['cílios', '#a855f7', '#c084fc'],
    ['unhas', '#ec4899', '#f9a8d4'],
    ['barbearia', '#f59e0b', '#fcd34d'],
    ['sobrancelhas', '#8b5cf6', '#a78bfa'],
    ['estética', '#10b981', '#6ee7b7'],
    ['depilação', '#f97316', '#fdba74'],
  ]

  it.each(ACENTOS)('%s: texto escuro lê sobre o gradiente', (_pack, acc, acc2) => {
    expect(contraste('#0a0a0f', acc)).toBeGreaterThanOrEqual(4.5)
    expect(contraste('#0a0a0f', acc2)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(ACENTOS)('%s: o tom claro serve de texto sobre a superfície', (_pack, _acc, acc2) => {
    expect(contraste(acc2, SURFACE)).toBeGreaterThanOrEqual(4.5)
  })
})
