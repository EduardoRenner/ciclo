import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { linhasDoResumo } from '@/core/assistente/resumo'

/**
 * Medido em produção em 2026-08-30: o `<dl>` do cartão de confirmação saía com ZERO filhos para
 * três das quatro ferramentas novas. O cartão procurava uma lista fixa de chaves minúsculas,
 * escrita quando `preparar_agendamento` era a única; as seguintes devolveram `Cliente`,
 * `Telefone`, `Anotação`, e JavaScript diferencia maiúscula. O dono via "Confirmar" sobre uma
 * caixa vazia — a proposta certa, o JSON certo, os testes verdes, e em branco só o pedaço que uma
 * pessoa tinha que julgar antes de clicar.
 *
 * Esta guarda lê as chaves de `resumo` DO CÓDIGO-FONTE das ferramentas e passa pelo renderizador
 * de verdade. Escrever as chaves esperadas aqui dentro seria a guarda cega de sempre: continuaria
 * verde com a ferramenta mudando embaixo.
 */
const FONTE = 'src/server/assistente/ferramentas.ts'

/** Chaves de primeiro nível de cada literal `resumo: { ... }`, com as chaves aninhadas ignoradas. */
function resumosDeclarados(): { linha: number; chaves: string[] }[] {
  const fonte = readFileSync(FONTE, 'utf8')
  const achados: { linha: number; chaves: string[] }[] = []

  let de = fonte.indexOf('resumo: {')
  while (de !== -1) {
    let profundidade = 0
    let fim = de
    for (let i = fonte.indexOf('{', de); i < fonte.length; i++) {
      if (fonte[i] === '{') profundidade++
      else if (fonte[i] === '}') {
        profundidade--
        if (profundidade === 0) { fim = i; break }
      }
    }
    const bloco = fonte.slice(fonte.indexOf('{', de) + 1, fim)

    const chaves: string[] = []
    let nivel = 0
    for (const trecho of bloco.split('\n')) {
      const m = nivel === 0 ? trecho.match(/^\s*(?:'([^']+)'|([A-Za-zÀ-ÿ_$][\wÀ-ÿ$]*))\s*:/) : null
      if (m) chaves.push(m[1] ?? m[2]!)
      for (const ch of trecho) {
        if (ch === '{' || ch === '(') nivel++
        else if (ch === '}' || ch === ')') nivel--
      }
    }

    achados.push({ linha: fonte.slice(0, de).split('\n').length, chaves })
    de = fonte.indexOf('resumo: {', fim)
  }
  return achados
}

describe('o cartão de confirmação nunca fica em branco', () => {
  const resumos = resumosDeclarados()

  it('achou os resumos no código — senão esta guarda passa vazia', () => {
    // Se o formato do arquivo mudar, a guarda GRITA em vez de aprovar por não ter o que checar.
    expect(resumos.length, `nenhum literal "resumo: {" encontrado em ${FONTE}`).toBeGreaterThanOrEqual(4)
    for (const r of resumos) {
      expect(r.chaves.length, `resumo da linha ${r.linha} saiu sem chaves — o extrator quebrou`).toBeGreaterThan(0)
    }
  })

  for (const { linha, chaves } of resumos) {
    it(`resumo da linha ${linha} (${chaves.join(', ')}) desenha pelo menos uma linha`, () => {
      const falso = Object.fromEntries(chaves.map((c) => [c, c.endsWith('Cents') ? 4500 : 'valor']))
      const linhas = linhasDoResumo(falso)
      expect(linhas.length, `o cartão sairia EM BRANCO — o dono confirmaria uma caixa vazia`).toBeGreaterThan(0)
      // Toda chave declarada tem que virar linha: uma que some é informação escondida de quem confirma.
      expect(linhas.length, 'alguma chave do resumo não virou linha no cartão').toBe(chaves.length)
    })
  }

  it('chave que a lista fixa não conhece continua aparecendo', () => {
    // O defeito exato: chave capitalizada, fora das seis que o cartão conhecia.
    const linhas = linhasDoResumo({ Cliente: 'Bruno', 'Anotação': 'prefere máquina 2' })
    expect(linhas.map((l) => l.rotulo)).toEqual(['Cliente', 'Anotação'])
  })

  it('valor vazio não vira linha fantasma', () => {
    expect(linhasDoResumo({ cliente: 'Ana', servico: '', profissional: null })).toHaveLength(1)
  })
})
