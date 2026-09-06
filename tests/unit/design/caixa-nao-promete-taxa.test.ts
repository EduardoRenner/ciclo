import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios as semComentariosDe } from '../../helpers/fonte'

/**
 * Achado da auditoria de 2026-08-28, na família "promete o canal que não entrega" — desta vez em
 * dinheiro.
 *
 * A tela do caixa mostrava três quadros lado a lado — Material, **Taxa**, Comissão — e dizia
 * "Sobrou: o que entrou menos material, taxa da maquininha e comissão". Só que NADA no projeto
 * escreve `tickets.fee_cents`: nem `fecharComanda`, nem pagamento, nem job. O quadro "Taxa"
 * mostrava R$ 0,00 desde a primeira comanda fechada e mostraria para sempre.
 *
 * Zero ao lado de dois números de verdade não se lê como "não implementado"; lê-se como "hoje não
 * teve taxa". O dono do salão que passa 60% no cartão fecha o mês achando que sobrou mais do que
 * sobrou — e essa é a conta que ele usa para decidir se paga o CICLO no mês seguinte.
 *
 * A guarda é de mão dupla, de propósito: no dia em que alguém escrever `fee_cents` de verdade, ela
 * para de exigir o silêncio e passa a exigir o quadro de volta. Guarda que só sabe proibir vira
 * dívida — é a lição da guarda do `vercel.json` (`CLAUDE.md`).
 *
 * **Esse dia chegou em 2026-09-06, com a `0066`.** `fecharComanda` passou a calcular a taxa a
 * partir da forma de pagamento escolhida no fechamento, e os dois últimos casos deste arquivo
 * viraram o outro lado da mão dupla: agora eles cobram que a conta use o valor CALCULADO e que
 * ele seja gravado. Ver `docs/49`.
 */

const SEPARADOR = String.fromCharCode(92)
const CAIXA = 'src/app/admin/caixa/caixa.tsx'
const RESUMO = 'src/server/services/caixa.ts'

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/\.tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

function semComentarios(caminho: string): string {
  return semComentariosDe(readFileSync(caminho, 'utf8'))
}

/**
 * Quem ESCREVE `fee_cents`, não quem o lê. `caixa.ts` (que só soma) e os tipos gerados ficam de
 * fora — casar com o nome solto acusaria o leitor e a guarda nasceria sempre-verde.
 */
function escrevemFeeCents(): string[] {
  return arquivos('src')
    .filter((f) => !f.endsWith('types.gen.ts') && f.split(SEPARADOR).join('/') !== RESUMO)
    .filter((f) => {
      const src = semComentarios(f)
      return /fee_cents\s*:/.test(src) || /update\([^)]*fee_cents/.test(src)
    })
}

const ESCRITORES = escrevemFeeCents()

describe('o caixa não anuncia uma taxa que ninguém calcula', () => {
  it('a leitura não voltou vazia — a guarda não passa por não ter olhado nada', () => {
    expect(arquivos('src').length, 'nenhum arquivo lido de src/').toBeGreaterThan(100)
    const tela = semComentarios(CAIXA)
    expect(tela.length, `${CAIXA} veio vazio`).toBeGreaterThan(500)
    expect(tela, 'a tela do caixa não mostra mais o Material — este teste precisa ser revisto junto').toMatch(/rotulo="Material"/)
  })

  it('sem ninguém escrevendo fee_cents, a tela não nomeia taxa nem maquininha', () => {
    if (ESCRITORES.length > 0) return
    const tela = semComentarios(CAIXA)
    const promessas = [/rotulo="Taxa"/, /maquininha/i, /taxa do cart[ãa]o/i]
    const achados = promessas.filter((p) => p.test(tela)).map((p) => p.source)
    expect(
      achados,
      'a tela do caixa fala de taxa e nada no projeto escreve `tickets.fee_cents` — o número seria ' +
        `zero para sempre, e zero ao lado de Material e Comissão se lê como "hoje não teve taxa". ` +
        `Termos: ${achados.join(', ')}`,
    ).toEqual([])
  })

  it('quando alguém passar a escrever fee_cents, a tela precisa voltar a mostrar', () => {
    if (ESCRITORES.length === 0) return
    expect(
      /rotulo="Taxa"/.test(semComentarios(CAIXA)),
      `${ESCRITORES.join(', ')} escreve(m) fee_cents e o caixa não mostra a linha de taxa — ` +
        'o dono passou a pagar a maquininha e o relatório continua sem contar',
    ).toBe(true)
  })

  /*
   * Esta parte mudou com a `0066`, e o motivo de ela ter mudado é o ponto: até então a guarda
   * pedia `feeCents: ticket.fee_cents` — a coluna do banco, que ninguém preenchia. Passar uma
   * coluna sempre-zero satisfazia a letra da guarda e não descontava nada.
   *
   * Agora o valor é calculado no fechamento, e o que precisa ser guardado é o par: a taxa é
   * CALCULADA e o resultado desse cálculo é o que entra na sobra e o que é gravado. Ler de volta
   * `ticket.fee_cents` (o valor de antes de fechar) volta a ser exatamente o defeito antigo — por
   * isso ele é proibido por nome.
   */
  it('a sobra desconta a taxa CALCULADA no fechamento, não uma coluna que ninguém preencheu', () => {
    const fechamento = semComentarios('src/server/services/comanda.ts')

    expect(
      /calcularTaxaDaMaquininha\(/.test(fechamento),
      'fecharComanda não calcula mais a taxa — sem isso `fee_cents` volta a ser zero para sempre',
    ).toBe(true)

    const chamada = /calcularSobraDaComanda\(\{[\s\S]*?\}\)/.exec(fechamento)
    expect(chamada?.[0], 'fecharComanda não chama mais calcularSobraDaComanda').toBeDefined()
    expect(
      /feeCents\s*(,|\}|:\s*feeCents\b)/.test(chamada![0]),
      'a sobra é calculada sem a taxa do fechamento — o lucro guardado ignoraria a maquininha',
    ).toBe(true)
    expect(
      /feeCents:\s*(0\b|ticket\.fee_cents)/.test(chamada![0]),
      'a sobra recebe zero fixo ou relê `ticket.fee_cents` (que vale zero antes de fechar) — ' +
        'é o defeito de 2026-08-28 de volta, agora disfarçado de conta',
    ).toBe(false)
  })

  it('o valor calculado é GRAVADO na comanda, senão o caixa soma zero de novo', () => {
    const fechamento = semComentarios('src/server/services/comanda.ts')
    const update = /\.update\(\{[\s\S]*?closed_at[\s\S]*?\}\)/.exec(fechamento)
    expect(update?.[0], 'o UPDATE que fecha a comanda mudou de forma — esta guarda precisa ser revista').toBeDefined()
    expect(/fee_cents:\s*feeCents\b/.test(update![0]), 'o fechamento não grava `fee_cents`').toBe(true)
    expect(/fee_bps:\s*feeBps\b/.test(update![0]), 'o fechamento não congela `fee_bps` — a comanda de agosto muda quando o dono renegocia em novembro').toBe(true)
  })
})
