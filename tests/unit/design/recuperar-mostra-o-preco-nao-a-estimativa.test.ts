import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A linha da fila "Recuperar receita" mostrava `valueCents`: preço × chance de voltar. Um corte de
 * R$ 70 aparecia como R$ 24,50, com "R$ 24,50 de lucro" embaixo, o mesmo número duas vezes e os dois
 * baixos demais para parecerem dinheiro de verdade. O dono pediu o valor do último serviço e só ele.
 *
 * O que muda quando o defeito volta: a linha voltar a ler `valueCents`/`profitCents` para escrever
 * um valor, ou a frase "de lucro" voltar à tela. `valueCents`/`profitCents` continuam existindo na
 * linha, mas quem decide "Sem valor avulso" é `fullValueCents === 0` (assinante e pacote zeram de propósito).
 */
const ARQUIVOS = ['src/app/admin/recuperar/recuperar.tsx', 'src/app/admin/recuperar/fila.tsx']

describe('a fila de recuperar mostra o preço do serviço, não a estimativa', () => {
  const fontes = ARQUIVOS.map((arquivo) => ({ arquivo, codigo: semComentarios(readFileSync(arquivo, 'utf8')) }))

  it('as duas telas continuam legíveis (a varredura não passa vazia)', () => {
    for (const { arquivo, codigo } of fontes) {
      expect(codigo.length, `${arquivo} veio vazio`).toBeGreaterThan(1000)
      expect(codigo, `${arquivo} deixou de formatar dinheiro`).toMatch(/dinheiro\.format\(/)
    }
  })

  it('cada uma escreve o preço cheio (fullValueCents, C-037)', () => {
    for (const { arquivo, codigo } of fontes) {
      expect(codigo, `${arquivo} não usa mais o preço do serviço`).toMatch(/dinheiro\.format\((?:item|atual)\.fullValueCents \/ 100\)/)
    }
  })

  it('nenhuma escreve valueCents ou profitCents como dinheiro, nem "de lucro"', () => {
    for (const { arquivo, codigo } of fontes) {
      expect(codigo, `${arquivo} voltou a mostrar a estimativa como valor da linha`).not.toMatch(/dinheiro\.format\((?:item|atual)\.(?:valueCents|profitCents)/)
      expect(codigo, `${arquivo} voltou a escrever "de lucro"`).not.toMatch(/de lucro/)
    }
  })

  /*
    docs/112 EXP-J01: a guarda olhava só as telas do Recuperar, e a manchete do Hoje ficou no campo
    antigo. Medido em 21/10 na mesma conta: Hoje "R$ 355,40" (totalValueCents, estimativa) e
    Recuperar "R$ 800,00" (totalFullValueCents, C-037) para as mesmas 6 clientes. O toque na
    manchete levava a um número diferente do que ela anunciava.
  */
  it('a manchete do Hoje anuncia o mesmo total que o topo do Recuperar', () => {
    const hoje = semComentarios(readFileSync('src/app/admin/hoje/page.tsx', 'utf8'))
    const recuperar = semComentarios(readFileSync('src/app/admin/recuperar/recuperar.tsx', 'utf8'))
    expect(recuperar, 'o topo do Recuperar mudou de campo: reveja esta guarda').toMatch(/lista\.totalFullValueCents/)
    expect(hoje, 'o Hoje anuncia outro total que o Recuperar').toMatch(/totalCents: emRisco\.totalFullValueCents/)
  })
})
