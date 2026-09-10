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

/**
 * O mesmo `token`, mas lendo o bloco `:root[data-theme="light"]`. O tema claro entrou em
 * 2026-09-10 com a própria paleta; sem isto, mudar uma cor clara sem olhar o contraste passava
 * despercebido — a guarda só via a paleta escura, que é o primeiro `--x:` do arquivo.
 */
const blocoClaro = (() => {
  const i = css.indexOf(':root[data-theme="light"]')
  if (i < 0) throw new Error('bloco :root[data-theme="light"] não existe — o tema claro sumiu?')
  return css.slice(i, css.indexOf('}', i))
})()

function tokenClaro(nome: string): string {
  const achado = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(blocoClaro)
  if (!achado?.[1]) throw new Error(`token claro --${nome} não encontrado`)
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

    /*
     * O acento entrou nesta conta em 2026-08-26, e entrou porque escapou dela.
     *
     * Quando --acc virou a cor da marca (aqua), o candidato natural para --acc-2
     * era a menta #5EEAD4 do próprio arquivo de logo. Ela dava Δ0,037 contra
     * --ok: link ativo e selo de sucesso viram a MESMA cor em daltonismo
     * vermelho-verde. O bloco acima não pegaria — ele só comparava semântico com
     * semântico, e --acc-2 não é semântico.
     *
     * --acc-2 é texto (link, aba ativa, foco) e convive na mesma tela que os
     * selos de estado, então precisa se separar deles pela mesma régua.
     * --info fica fora pelo mesmo motivo do bloco de cima: é azul, outro eixo.
     */
    it.each([['ok'], ['warn'], ['risk'], ['bad']])(
      '--acc-2 e --%s têm Δ luminância de pelo menos 0,15',
      (semantico) => {
        const delta = Math.abs(luminanciaToken('acc-2') - luminanciaToken(semantico))
        expect(delta, `Δ(--acc-2, --${semantico}) = ${delta.toFixed(3)}`).toBeGreaterThanOrEqual(PISO)
      },
    )
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

describe('a paleta CLARA também passa no WCAG AA', () => {
  const BG_C = tokenClaro('bg')
  const SURFACE_C = tokenClaro('surface')
  const SURFACE_2_C = tokenClaro('surface-2')
  const SURFACE_3_C = tokenClaro('surface-3')

  it('as quatro superfícies claras são distintas', () => {
    expect(new Set([BG_C, SURFACE_C, SURFACE_2_C, SURFACE_3_C]).size).toBe(4)
  })

  it.each(['txt', 'txt-2', 'txt-3'])('--%s claro tem 4,5:1 sobre as quatro superfícies', (nome) => {
    for (const s of [BG_C, SURFACE_C, SURFACE_2_C, SURFACE_3_C]) {
      expect(contraste(tokenClaro(nome), s), `${nome} claro sobre ${s}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('--on-acc claro tem 4,5:1 sobre --acc e --acc-2 claros', () => {
    const onAcc = tokenClaro('on-acc')
    expect(contraste(onAcc, tokenClaro('acc'))).toBeGreaterThanOrEqual(4.5)
    expect(contraste(onAcc, tokenClaro('acc-2'))).toBeGreaterThanOrEqual(4.5)
  })

  it('--acc-2 claro (link, foco) tem 4,5:1 como texto sobre bg e surface', () => {
    expect(contraste(tokenClaro('acc-2'), BG_C)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(tokenClaro('acc-2'), SURFACE_C)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['ok', 'warn', 'risk', 'bad', 'info'])('--%s claro tem 4,5:1 como texto sobre o card', (nome) => {
    expect(contraste(tokenClaro(nome), SURFACE_C)).toBeGreaterThanOrEqual(4.5)
  })

  it('ok e bad claros ainda se separam por luminância o quanto o teto de 4,5:1 permite', () => {
    /*
     * No escuro o piso é 0,15 (Parte II §3.7). No claro é impossível: para os cinco semânticos
     * passarem 4,5:1 sobre branco todos ficam abaixo de L=0,18, e não cabe 0,15 de distância
     * entre eles nessa faixa. O melhor alcançável é ~0,13 (ok↔bad). O tema claro compensa com
     * ícone + rótulo no estado, nunca cor sozinha — registrado no docs/DECISOES.md.
     * Este piso baixo pega a regressão real: alguém deixar ok e bad na MESMA luminância.
     */
    const delta = Math.abs(luminancia(tokenClaro('ok')) - luminancia(tokenClaro('bad')))
    expect(delta, `Δ(ok, bad) claro = ${delta.toFixed(3)}`).toBeGreaterThanOrEqual(0.1)
  })
})
