import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `docs/18` Fase K: "Cancelar — autoatendimento, mesmo número de cliques que assinar." Assinar
 * (`assinar-plano.tsx`) é um `onClick` que chama `fetch` direto, sem modal. Este teste guarda que
 * cancelar segue a MESMA forma — não um passo de confirmação a mais que quebraria a paridade que a
 * casa decidiu, e não um `useTransition` (a Action que rejeita derruba a tela no React 19).
 */
const PAGINA = 'src/app/admin/config/meu-plano/page.tsx'
const BOTAO = 'src/app/admin/config/meu-plano/cancelar-assinatura.tsx'

describe('meu-plano: cancelar custa o mesmo clique que assinar', () => {
  const pagina = semComentarios(readFileSync(PAGINA, 'utf8'))
  const botao = semComentarios(readFileSync(BOTAO, 'utf8'))

  it('as leituras não voltaram vazias', () => {
    expect(pagina.length).toBeGreaterThan(500)
    expect(botao.length).toBeGreaterThan(300)
  })

  it('a página renderiza <CancelarAssinatura> só com assinatura ativa e cobrancaAutomatica', () => {
    expect(pagina).toMatch(/cobrancaAutomatica\s*&&\s*assinatura[\s\S]{0,80}<CancelarAssinatura/)
  })

  it('o botão chama a rota de cancelar de verdade, num único onClick', () => {
    expect(botao).toMatch(/fetch\(\s*['"]\/api\/v1\/billing\/cancelar['"]/)
    expect(botao).toMatch(/onClick=\{cancelar\}/)
  })

  it('nenhum modal de confirmação — o clique único É a decisão, não uma omissão', () => {
    expect(botao).not.toMatch(/confirm\(|window\.confirm|<Dialog|<Sheet/)
  })

  it('o checkout de cancelar não usa useTransition e manda idempotency-key', () => {
    expect(botao, 'useTransition + await solto derruba a tela no React 19 (armadilha do CLAUDE.md)').not.toMatch(/useTransition/)
    expect(botao).toMatch(/['"]idempotency-key['"]/i)
  })

  it('o detector reconhece o defeito que ele impede', () => {
    const semGuarda = 'return (\n  <CancelarAssinatura />\n)'
    expect(/cobrancaAutomatica\s*&&\s*assinatura[\s\S]{0,80}<CancelarAssinatura/.test(semGuarda)).toBe(false)
  })
})
