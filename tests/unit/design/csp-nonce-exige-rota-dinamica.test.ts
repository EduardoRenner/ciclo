import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { cabecalhosDeSeguranca, rotaDeConteudoEstatico } from '@/middleware'

/**
 * CSP com nonce por requisição e HTML cacheado NÃO convivem: o nonce gravado nos `<script>` fica
 * congelado na primeira renderização, o header muda a cada chamada, os dois nunca voltam a bater,
 * e o navegador bloqueia todo `<script>`. Medido em produção em 01/09/2026 (`docs/DECISOES.md`),
 * com `read_console_messages` num navegador de verdade: `/`, `/precos`, `/privacidade`, `/termos` —
 * e até `/entrar` — ficaram sem JavaScript nenhum. O conserto de então: `force-dynamic` no layout
 * raiz, tirando o cache de todo mundo.
 *
 * `perf/csp-duas-faixas` trocou isso por uma separação: as quatro rotas de CONTEÚDO ESTÁTICO
 * (`rotaDeConteudoEstatico`) recebem uma CSP **sem nonce** e voltam a poder ser cacheadas; o resto
 * do site mantém a CSP com nonce e `force-dynamic` (que mudou do layout raiz para
 * `src/app/admin/layout.tsx`). Sem nonce não há valor para congelar — o descasamento é impossível
 * por construção.
 *
 * Esta guarda existe para que essa separação não seja quebrada de nenhum dos dois lados:
 *   - ninguém pode pôr uma rota com dado de usuário/entrada de credencial na lista sem nonce;
 *   - ninguém pode tirar o `force-dynamic` do painel, deixando rota com nonce virar cache.
 */
const LAYOUT_RAIZ = 'src/app/layout.tsx'
const LAYOUT_PAINEL = 'src/app/admin/layout.tsx'
const MIDDLEWARE = 'src/middleware.ts'
const NONCE_FALSO = 'ABC123abc456=='

describe('a CSP em duas faixas: nonce só onde o HTML é dinâmico', () => {
  it('a rota de conteúdo estático recebe CSP SEM nonce e SEM strict-dynamic', () => {
    const csp = cabecalhosDeSeguranca(null)
    expect(csp, 'CSP estática não pode ter nonce — é o valor que congela no HTML cacheado').not.toMatch(
      /nonce-/,
    )
    expect(csp, 'sem nonce não há strict-dynamic — o navegador ignoraria e travaria tudo').not.toMatch(
      /strict-dynamic/,
    )
    expect(csp).toMatch(/script-src 'self' 'unsafe-inline'/)
  })

  it('a rota dinâmica recebe CSP COM nonce e strict-dynamic', () => {
    const csp = cabecalhosDeSeguranca(NONCE_FALSO)
    expect(csp).toMatch(new RegExp(`nonce-${NONCE_FALSO}`))
    expect(csp).toMatch(/strict-dynamic/)
  })

  it('só as quatro páginas de conteúdo — nada que leia sessão, tenant ou credencial', () => {
    for (const rota of ['/', '/precos', '/privacidade', '/termos']) {
      expect(rotaDeConteudoEstatico(rota), `${rota} devia ser servida sem nonce`).toBe(true)
    }
    // As que PRECISAM de nonce: recebem input ou dependem de quem pede.
    for (const rota of ['/entrar', '/cadastro', '/nova-senha', '/admin/hoje', '/admin', '/onboarding', '/salao-da-bia', '/api/v1/tickets']) {
      expect(rotaDeConteudoEstatico(rota), `${rota} NÃO pode entrar na faixa sem nonce`).toBe(false)
    }
  })

  it('o painel força renderização dinâmica — rota com nonce nunca pode virar cache', () => {
    const fonte = readFileSync(LAYOUT_PAINEL, 'utf8')
    expect(fonte.length, `${LAYOUT_PAINEL} veio vazio — o teste passaria por não achar nada`).toBeGreaterThan(500)
    expect(
      /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/.test(fonte),
      `${LAYOUT_PAINEL} perdeu \`export const dynamic = 'force-dynamic'\`. O painel recebe a CSP ` +
        'com nonce; se o Next cachear o HTML de uma tela dele, o nonce congela e o navegador ' +
        'bloqueia todo JavaScript do painel (o incidente de 01/09/2026, agora restrito ao /admin).',
    ).toBe(true)
  })

  it('o layout raiz NÃO força mais dinâmico — senão a separação não tem efeito nenhum', () => {
    const fonte = readFileSync(LAYOUT_RAIZ, 'utf8')
    // Só o código: o comentário do próprio arquivo cita `force-dynamic` ao contar a história.
    const semComentario = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(
      /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/.test(semComentario),
      `${LAYOUT_RAIZ} voltou a ter \`force-dynamic\` — isso força TODA rota a dinâmica de novo, ` +
        'inclusive `/` e `/precos`, e a faixa sem nonce deixa de servir para qualquer coisa.',
    ).toBe(false)
  })

  it('o middleware continua gerando um nonce novo por requisição para as rotas dinâmicas', () => {
    const fonte = readFileSync(MIDDLEWARE, 'utf8')
    expect(
      /crypto\.randomUUID\(\)/.test(fonte) && /rotaDeConteudoEstatico\(/.test(fonte),
      `${MIDDLEWARE} não gera mais nonce condicional — se o nonce por requisição sumiu, ou a ` +
        'seleção de faixa sumiu, a garantia se desfaz.',
    ).toBe(true)
  })

  it('os detectores reconhecem as duas regressões que substituíram o guard antigo', () => {
    // Regressão A: nonce numa CSP de rota estática (o defeito de 01/09).
    const cspComNonceIndevido = cabecalhosDeSeguranca('x')
    expect(/nonce-/.test(cspComNonceIndevido), 'o detector de nonce indevido casaria').toBe(true)
    // Regressão B: rota com credencial entrando na faixa sem nonce.
    expect(rotaDeConteudoEstatico('/entrar')).toBe(false)
  })
})
