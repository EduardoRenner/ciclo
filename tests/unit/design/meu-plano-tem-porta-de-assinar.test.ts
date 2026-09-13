import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `docs/57` PR 1.3. A tela `/admin/config/meu-plano` ganhou o botão "Assinar" — o único caminho de
 * autoatendimento para virar pagante. Até 2026-09-09 ela mandava "falar com a gente" e nada mais.
 *
 * O que este teste guarda, casando com o USO (não o nome solto num `import`):
 *  - o botão só aparece atrás de `cobrancaAutomatica` (regra 5.4 do `docs/18`: sem credencial do MP,
 *    não fingir que a cobrança existe — o link de WhatsApp continua sendo o fallback);
 *  - o componente do botão chama `/api/v1/billing/assinar` de verdade;
 *  - o `fetch` do checkout NÃO usa `useTransition` (a Action que rejeita derruba a tela no React 19
 *    — armadilha do CLAUDE.md), e manda `idempotency-key` (a rota exige).
 */
const PAGINA = 'src/app/admin/config/meu-plano/page.tsx'
const BOTAO = 'src/app/admin/config/meu-plano/assinar-plano.tsx'

describe('meu-plano: a porta de assinar', () => {
  const pagina = semComentarios(readFileSync(PAGINA, 'utf8'))
  const botao = semComentarios(readFileSync(BOTAO, 'utf8'))

  it('as leituras não voltaram vazias', () => {
    expect(pagina.length).toBeGreaterThan(500)
    expect(botao.length).toBeGreaterThan(300)
  })

  it('a página renderiza <AssinarPlano> só quando cobrancaAutomatica é verdadeiro', () => {
    // `cobrancaAutomatica ? ( <AssinarPlano ... ) : ( ...link de whatsapp... )`
    expect(pagina).toMatch(/cobrancaAutomatica\s*\?[\s\S]{0,60}<AssinarPlano/)
    // e cobrancaAutomatica sai da presença da credencial, não de um flag solto
    expect(pagina).toMatch(/cobrancaAutomatica\s*=\s*Boolean\(process\.env\.MERCADOPAGO_ACCESS_TOKEN\)/)
  })

  it('o botão chama a rota de assinar de verdade', () => {
    expect(botao).toMatch(/fetch\(\s*['"]\/api\/v1\/billing\/assinar['"]/)
    expect(botao).toContain('window.location.href')
  })

  it('o checkout não usa useTransition e manda idempotency-key', () => {
    expect(botao, 'useTransition + await solto derruba a tela no React 19 (armadilha do CLAUDE.md)').not.toMatch(/useTransition/)
    expect(botao).toMatch(/['"]idempotency-key['"]/i)
  })

  it('o detector reconhece o defeito que ele impede', () => {
    // se alguém tirar a guarda `cobrancaAutomatica` e deixar o botão sempre visível, o primeiro
    // `toMatch` acima falha. Aqui provo que o padrão não casa com uma versão "sempre mostra".
    const semGuarda = 'return (\n  <AssinarPlano tier={tier} />\n)'
    expect(/cobrancaAutomatica\s*\?[\s\S]{0,60}<AssinarPlano/.test(semGuarda)).toBe(false)
  })
})
