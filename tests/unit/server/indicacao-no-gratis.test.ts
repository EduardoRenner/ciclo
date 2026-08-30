import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { PLANOS } from '@/core/billing/planos'

/**
 * I-8, `docs/30-INDICACAO-PLANO.md` §5.2 — decisão do Eduardo em 29/08, registrada em
 * `docs/DECISOES.md`:
 *
 * > **O link de convite fica no Grátis; os pontos automáticos ficam no Equipe.**
 *
 * Hoje isso é verdade **por construção**, não por trava explícita: nenhum ponto do caminho de
 * agendamento público chama `exigirModulo`, e `pontuarAtendimentoConcluido` chama
 * `podeUsarModulo(plano, 'loyalty')` antes de creditar. Ou seja, a divisão certa existe porque
 * ninguém a escreveu — e é exatamente esse tipo de acerto que some no primeiro refactor que
 * "uniformiza as travas".
 *
 * Esta guarda fixa os dois lados:
 *
 * 1. **O laço é de graça.** Se alguém puser `exigirModulo` no caminho do booking público, o salão
 *    do Grátis para de conseguir receber cliente por indicação — e o laço morre exatamente onde
 *    ele geraria mais pressão de upgrade (o teto de 50 clientes). Cada link compartilhado também
 *    é uma página `/{slug}` do CICLO circulando com o selo: travar isso é desligar distribuição.
 * 2. **A automação é paga.** Se alguém tirar a checagem de `loyalty` de
 *    `pontuarAtendimentoConcluido`, o tenant `gratis` volta a pontuar sozinho — que é literalmente
 *    o defeito medido em produção em 2026-08-26 (nenhum dos 11 tenants tinha `settings.loyalty`
 *    gravado, e `dom-rocha` acumulou 9 lançamentos em 263 atendimentos).
 */

const PUBLIC_BOOKING = 'src/server/services/public-booking.ts'
const BOOK_ROUTE = 'src/app/api/v1/public/[slug]/book/route.ts'
const AGENDAMENTOS = 'src/server/services/agendamentos.ts'
const FIDELIDADE = 'src/server/services/fidelidade.ts'

function semComentarios(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/[{][/][*][\s\S]*?[*][/][}]/g, ' ')
    .replace(/[/][*][\s\S]*?[*][/]/g, ' ')
    .replace(/^\s*[/][/].*$/gm, ' ')
}

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/[.]tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

describe('a leitura deste teste', () => {
  it('enxerga os quatro arquivos do caminho', () => {
    for (const arquivo of [PUBLIC_BOOKING, BOOK_ROUTE, AGENDAMENTOS, FIDELIDADE]) {
      expect(semComentarios(arquivo).length, `${arquivo} veio vazio`).toBeGreaterThan(300)
    }
  })

  it('a divisão de planos que esta guarda protege ainda existe', () => {
    // Sanidade: se `loyalty` cair no Grátis, a divisão deixa de ter sentido e os dois testes
    // abaixo passariam protegendo nada.
    expect(PLANOS.gratis.modulos, '`loyalty` entrou no Grátis — a decisão do §5.2 mudou?').not.toContain('loyalty')
    expect(PLANOS.equipe.modulos, '`loyalty` saiu do Equipe — a decisão do §5.2 mudou?').toContain('loyalty')
  })
})

describe('o LAÇO é de graça — nada trava a indicação por plano', () => {
  it('o caminho do agendamento público não exige módulo nenhum', () => {
    for (const arquivo of [PUBLIC_BOOKING, BOOK_ROUTE]) {
      const fonte = semComentarios(arquivo)
      expect(
        /exigirModulo\s*\(/.test(fonte),
        `${arquivo} passou a exigir módulo. O agendamento público é como a cliente indicada ENTRA: ` +
          'travar por plano mata o laço de indicação no Grátis, que é justamente o degrau onde ele ' +
          'gera pressão de upgrade — e desliga a distribuição das páginas /{slug} com selo. ' +
          'Ver docs/30 §5.2 e a decisão de 29/08 em docs/DECISOES.md.',
      ).toBe(false)
    }
  })

  it('a gravação de referred_by não é condicionada a módulo nem a plano', () => {
    // Casa com o bloco da validação até o insert — se um `podeUsarModulo`/`exigirModulo` aparecer
    // no meio do caminho que grava a coluna, a indicação vira recurso pago por dentro.
    const fonte = semComentarios(AGENDAMENTOS)
    const inicio = fonte.indexOf('let referenciaValida')
    const fim = fonte.indexOf('.select(\'id\')', inicio)
    expect(inicio, 'não achei o bloco que resolve o referenciador').toBeGreaterThan(-1)
    expect(fim, 'não achei o insert de clients depois do bloco').toBeGreaterThan(inicio)

    const bloco = fonte.slice(inicio, fim)
    expect(
      /exigirModulo|podeUsarModulo|podeUsarCapacidade|verificarLimite/.test(bloco),
      'a gravação de `referred_by` passou a depender de plano — o convite deixaria de funcionar no Grátis',
    ).toBe(false)
  })
})

describe('a AUTOMAÇÃO é paga — os pontos continuam atrás do módulo loyalty', () => {
  it('pontuarAtendimentoConcluido confere o módulo ANTES de montar qualquer lançamento', () => {
    const fonte = semComentarios(FIDELIDADE)
    const checagem = fonte.indexOf("podeUsarModulo(plano, 'loyalty')")
    const primeiroLancamento = fonte.indexOf('lancamentos.push')
    expect(
      checagem,
      'a checagem de `loyalty` sumiu de fidelidade.ts — tenant do Grátis volta a pontuar sozinho, ' +
        'que é o defeito medido em produção em 2026-08-26',
    ).toBeGreaterThan(-1)
    expect(primeiroLancamento, 'não achei onde os lançamentos são montados').toBeGreaterThan(-1)
    expect(checagem, 'a checagem de módulo ficou DEPOIS do primeiro lançamento').toBeLessThan(primeiroLancamento)
  })

  it('o bônus dos dois lados está dentro do trecho protegido pelo módulo', () => {
    const fonte = semComentarios(FIDELIDADE)
    const checagem = fonte.indexOf("podeUsarModulo(plano, 'loyalty')")
    const bonus = fonte.indexOf("'Indicou um novo cliente'")
    expect(bonus, 'o lançamento "Indicou um novo cliente" sumiu').toBeGreaterThan(-1)
    expect(bonus, 'o bônus de indicação saiu de trás da trava de módulo').toBeGreaterThan(checagem)
  })

  it('nenhuma OUTRA parte do produto credita pontos sem passar por uma trava', () => {
    // Guarda contra o próprio detector: se alguém criar um segundo caminho de crédito, a
    // checagem em `fidelidade.ts` continua lá e este arquivo passaria verde protegendo metade.
    const escritores = arquivos('src')
      .filter((f) => !f.endsWith('types.gen.ts'))
      .filter((f) => /from\('loyalty_entries'\)[\s\S]{0,200}?\.insert\(/.test(semComentarios(f)))
      .map((f) => f.split(String.fromCharCode(92)).join('/'))

    const semTrava = escritores.filter((f) => {
      const fonte = semComentarios(f)
      return !/podeUsarModulo|exigirModulo/.test(fonte)
    })

    expect(
      semTrava,
      'estes arquivos inserem em `loyalty_entries` sem nenhuma checagem de módulo por perto — ' +
        'crédito de pontos é recurso do Equipe (docs/30 §5.2)',
    ).toEqual([])
  })
})
