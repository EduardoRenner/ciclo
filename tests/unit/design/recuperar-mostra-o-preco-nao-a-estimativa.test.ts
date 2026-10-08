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
 * linha para uma coisa só: decidir "Sem valor avulso" (assinante e pacote zeram os dois de propósito).
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

  it('cada uma escreve o priceCents', () => {
    for (const { arquivo, codigo } of fontes) {
      expect(codigo, `${arquivo} não usa mais o preço do serviço`).toMatch(/dinheiro\.format\((?:item|atual)\.priceCents \/ 100\)/)
    }
  })

  it('nenhuma escreve valueCents ou profitCents como dinheiro, nem "de lucro"', () => {
    for (const { arquivo, codigo } of fontes) {
      expect(codigo, `${arquivo} voltou a mostrar a estimativa como valor da linha`).not.toMatch(/dinheiro\.format\((?:item|atual)\.(?:valueCents|profitCents)/)
      expect(codigo, `${arquivo} voltou a escrever "de lucro"`).not.toMatch(/de lucro/)
    }
  })
})
