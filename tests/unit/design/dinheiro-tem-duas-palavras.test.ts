import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * No CICLO, dinheiro tem duas palavras e elas nao sao sinonimos:
 *
 *   "atendido" -> soma de `price_cents` do AGENDAMENTO. Preco de tabela. Nao enxerga desconto dado
 *                 na comanda, item extra lancado nem gorjeta.
 *   "entrou"   -> soma de `tickets.total_cents` das comandas FECHADAS. Dinheiro de verdade.
 *
 * Em 31/08 tres telas chamavam o primeiro pelo nome do segundo: "Faturado hoje" (Hoje), "Ja
 * gastou" (ficha) e "ja gastou R$ X" (campanhas). Num dia com desconto, todas mostravam mais do
 * que a pessoa pagou — e nas duas ultimas com o nome da cliente ao lado.
 *
 * Esta guarda protege o vocabulario, nao um texto especifico: se um numero derivado de preco de
 * tabela voltar a se chamar "faturado" ou "gastou", ela reprova.
 */
const BARRA = String.fromCharCode(92)


function tsxDe(dir: string): string[] {
  const achados: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) achados.push(...tsxDe(caminho))
    else if (e.name.endsWith('.tsx')) achados.push(caminho)
  }
  return achados
}

/** So telas do produto: `/dev/ui` e vitrine de componentes. */
const TELAS = tsxDe(join('src', 'app')).filter((f) => !f.includes('dev'))

/*
 * Excecao unica e declarada: a ficha explica "Veio por indicacao de <fulana>", que e sobre
 * INDICACAO e nao sobre dinheiro. A guarda casa com "gast", entao nao pega essa — esta escrito
 * aqui para o proximo leitor nao procurar em vao.
 */
describe('preco de tabela nao se chama faturamento nem gasto', () => {
  it('ha telas para varrer — senao a guarda passa vazia', () => {
    expect(TELAS.length, 'nenhuma tela encontrada — o extrator quebrou').toBeGreaterThan(20)
  })

  for (const tela of TELAS) {
    const fonte = semComentarios(readFileSync(tela, 'utf8'))
    // So interessa quem MOSTRA um valor derivado das colunas de preco de tabela.
    if (!/ltv_cents|ltvCents|revenueTodayCents/.test(fonte)) continue

    it(`${tela.split(BARRA).join('/')} nao promete gasto nem faturamento`, () => {
      expect(fonte, 'voltou a chamar preco de tabela de "gastou"').not.toMatch(/gastou/i)
      expect(fonte, 'voltou a chamar preco de tabela de "faturado"').not.toMatch(/faturad/i)
    })
  }
})
