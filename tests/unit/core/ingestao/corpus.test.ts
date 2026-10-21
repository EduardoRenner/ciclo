import { describe, expect, it } from 'vitest'

import { corpus, type Variacao } from '../../../fixtures/ingestao/gerador'

import { decodificar } from '@/core/ingestao/codificacao'
import { gradeDeTexto } from '@/core/ingestao/delimitado'
import { processarGrade, type ResultadoDaEsteira } from '@/core/ingestao/esteira'
import { farejarFormato } from '@/core/ingestao/formato'

/**
 * CNV-008 · O corpus mede a esteira (`docs/97` §12). Pisos (a CI reprova se piorar):
 *   · FALSO-ACEITE = 0 — nenhum valor entra no campo errado ou diferente do gabarito;
 *   · pessoas = gabarito em toda variação (nenhuma some, nenhuma duplica);
 *   · CPF e alergia NUNCA aparecem dentro de uma ficha;
 *   · perda (valor do gabarito que não entrou) = 0 no corpus sintético.
 */
const HOJE = '2026-10-13'

function rodar(v: Variacao): ResultadoDaEsteira {
  const f = farejarFormato(v.bytes, 'base.csv')
  if (!f.aceito || f.formato !== 'texto') throw new Error(`${v.nome}: formato ${JSON.stringify(f)}`)
  const { grade } = gradeDeTexto(decodificar(v.bytes).texto)
  return processarGrade(grade, { hoje: HOJE })
}

type Medida = { falsoAceite: string[]; perda: string[]; pessoas: number; esperadas: number; vazou: boolean }

function medir(v: Variacao, r: ResultadoDaEsteira): Medida {
  const falsoAceite: string[] = []
  const perda: string[] = []
  const porNome = new Map(r.registros.map((x) => [x.nome, x]))
  for (const g of v.gabarito) {
    const x = porNome.get(g.nome)
    if (!x) {
      perda.push(`${g.nome}: não entrou`)
      continue
    }
    const confere = (campo: string, obtido: string | null, esperado: string | null) => {
      if (obtido !== null && obtido !== esperado) falsoAceite.push(`${g.nome}.${campo}: ${obtido} ≠ ${esperado}`)
      if (obtido === null && esperado !== null) perda.push(`${g.nome}.${campo}`)
    }
    confere('telefone', x.telefone, g.telefone)
    confere('email', x.email, g.email)
    confere('ultimaVisita', x.ultimaVisita, g.ultimaVisita)
    // Sem cabeçalho, o gerador não escreve nascimento.
    if (v.estilo.cabecalho !== 'nenhum' && v.estilo.grao === 'cliente') confere('nascimento', x.nascimento, g.nascimento)
  }
  // Ficha com nome que não existe no gabarito é dado estranho dentro do nome ("Bia Luíza Conceição":
  // a coluna do profissional virou sobrenome) — falso-aceite, não perda.
  const nomes = new Set(v.gabarito.map((g) => g.nome))
  for (const x of r.registros) if (!nomes.has(x.nome)) falsoAceite.push(`ficha com nome que não existe: ${x.nome}`)
  const textoDasFichas = JSON.stringify(r.registros)
  const vazou = v.gabarito.some((g) => textoDasFichas.includes(g.cpf) || textoDasFichas.includes(g.alergia))
  return { falsoAceite, perda, pessoas: r.registros.length, esperadas: v.gabarito.length, vazou }
}

describe('corpus sintético da esteira (CNV-008)', () => {
  const variacoes = corpus(48)

  it('controle positivo: o corpus cobre as classes de problema', () => {
    const estilos = variacoes.map((v) => v.estilo)
    expect(new Set(estilos.map((e) => e.codificacao)).size).toBe(4)
    expect(new Set(estilos.map((e) => e.separador)).size).toBe(4)
    expect(new Set(estilos.map((e) => e.cabecalho)).size).toBe(5)
    expect(new Set(estilos.map((e) => e.telefone)).size).toBe(6)
    expect(estilos.some((e) => e.grao === 'atendimento')).toBe(true)
    expect(estilos.some((e) => e.armadilhas)).toBe(true)
    expect(estilos.some((e) => e.data === 'excel')).toBe(true)
  })

  for (const v of variacoes) {
    it(v.nome, () => {
      const r = rodar(v)
      const c = r.contagem
      expect(c.ouro + c.comAviso + c.quarentena + c.ignoradas).toBe(c.lidas)
      const m = medir(v, r)
      expect(m.falsoAceite, 'falso-aceite').toEqual([])
      expect(m.vazou, 'CPF ou alergia dentro de uma ficha').toBe(false)
      expect(m.pessoas, 'pessoas').toBe(m.esperadas)
      expect(m.perda, 'perda').toEqual([])
    })
  }
})
