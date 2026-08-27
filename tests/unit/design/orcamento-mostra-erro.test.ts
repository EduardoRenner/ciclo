import { describe, expect, it } from 'vitest'

import { telaDoOrcamento } from '@/app/(public)/orcamento/[token]/orcamento'

/**
 * Medido no ar em 2026-08-27, com token inválido em `/orcamento/{token}`:
 *
 * - a API respondeu **404 em ~400 ms**, com a mensagem certa ("Link inválido ou expirado.");
 * - a tela ficou em *"Carregando orçamento…"* por **mais de 15 segundos**, sem mensagem, sem ação
 *   e sem saída.
 *
 * A causa era uma linha de ordem: o ramo `estado === 'carregando' || !dados` vinha ANTES do ramo
 * de erro. O `|| !dados` existia para o TypeScript estreitar o tipo — e **erro é exatamente o caso
 * em que `dados` é `null`**, então o ramo de erro era inalcançável. Typecheck feliz, testes verdes,
 * pessoa esperando para sempre.
 *
 * O irmão `/avaliar/[token]` nunca teve o `|| !dados` e por isso sempre mostrou o erro certo.
 *
 * Este teste guarda a ORDEM, que é a regra: **erro antes de carregando**, mesmo sem dados.
 */

describe('telaDoOrcamento', () => {
  it('erro sem dados mostra ERRO, não carregando — o defeito exato que estava no ar', () => {
    // Token inválido: a busca falhou, `estado` virou 'erro' e `dados` nunca chegou.
    expect(telaDoOrcamento('erro', false)).toBe('erro')
  })

  it('erro com dados também mostra erro (falha ao aprovar, por exemplo)', () => {
    expect(telaDoOrcamento('erro', true)).toBe('erro')
  })

  it('carregando de verdade continua mostrando carregando', () => {
    expect(telaDoOrcamento('carregando', false)).toBe('carregando')
  })

  it('sem erro e sem dados ainda é carregando — não vira tela em branco', () => {
    expect(telaDoOrcamento('pronto', false)).toBe('carregando')
  })

  it('os estados finais continuam alcançáveis', () => {
    expect(telaDoOrcamento('aprovado', true)).toBe('aprovado')
    expect(telaDoOrcamento('recusado', true)).toBe('recusado')
    expect(telaDoOrcamento('pronto', true)).toBe('conteudo')
    expect(telaDoOrcamento('recusando', true)).toBe('conteudo')
  })
})
