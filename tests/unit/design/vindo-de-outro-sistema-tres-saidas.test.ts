import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `docs/83-ONBOARDING-E-MIGRACAO-PLANO.md` §5.4 (P2) — as três saídas da tela "Vindo de outro
 * sistema", nessa ordem: Traga agora, Use junto por enquanto, Me manda que eu faço. O P1
 * (`5815bc5c`) só linkava duas rotas soltas; este teste prova que as três saídas continuam de pé,
 * na ordem certa, e que a que depende de canal fica CONDICIONAL a ele existir.
 *
 * Varredura de fonte, não render — mesmo raciocínio de `hoje-heroi-do-motor.test.ts`: este projeto
 * não tem harness de render de componente. Casa com os `href` de verdade e com a CHAMADA de
 * `canalDeContato(`, nunca com nome solto de import ou com prosa de comentário (armadilha nº1 do
 * CLAUDE.md) — por isso o arquivo passa por `semComentarios` antes de qualquer asserção.
 */
const ARQUIVO = join('src', 'app', 'admin', 'clientes', 'vindo-de-outro-sistema', 'page.tsx')
const FONTE_COMPLETA = readFileSync(ARQUIVO, 'utf8')
const FONTE = semComentarios(FONTE_COMPLETA)

describe('tela "Vindo de outro sistema" — as três saídas do §5.4', () => {
  it('saída 1 (Traga agora) leva pro importador CSV e pro ja-atendo', () => {
    expect(FONTE).toContain('href="/admin/clientes/importar"')
    expect(FONTE).toContain('href="/admin/clientes/ja-atendo"')
  })

  it('saída 2 (usar junto) também aponta pro ja-atendo — é o mesmo "alguém que você já atende voltou" que sustenta a camada de recuperação', () => {
    // As DUAS ocorrências de ja-atendo (saída 1 e saída 2) — se uma sumir, uma das saídas ficou sem destino.
    const ocorrencias = FONTE.match(/href="\/admin\/clientes\/ja-atendo"/g) ?? []
    expect(ocorrencias.length).toBe(2)
  })

  it('saída 3 (Me manda que eu faço) consulta `canalDeContato`, não escreve um número à mão', () => {
    expect(/canalDeContato\s*\(/.test(FONTE)).toBe(true)
    // Nenhum número de telefone literal: a decisão de contato mora só em `lib/contato.ts`.
    expect(/\b\d{10,}\b/.test(FONTE)).toBe(false)
  })

  it('saída 3 é CONDICIONAL ao canal existir — sem isso seria um link morto', () => {
    // O padrão do resto da base (`meu-plano/page.tsx`, `precos/page.tsx`): `const x = canalDeContato(...)`
    // e depois `{x ? <a href={x.href}>...` — nunca o `.href` usado fora de um ramo que testa a variável.
    expect(/const\s+CANAL_AJUDA_IMPORTACAO\s*=\s*canalDeContato\s*\(/.test(FONTE)).toBe(true)
    expect(/CANAL_AJUDA_IMPORTACAO\s*\?/.test(FONTE)).toBe(true)
  })

  it('mensagem pronta do §5.3 continua na tela, para pedir a exportação ao sistema antigo', () => {
    expect(FONTE_COMPLETA).toContain(
      'Olá! Quero receber a lista dos meus clientes numa planilha (Excel ou CSV), com nome, telefone e a',
    )
  })

  it('NÃO promete o benefício de plano (1 mês de Essencial) — decisão de preço ainda não tomada (§5.4)', () => {
    expect(/essencial/i.test(FONTE)).toBe(false)
    expect(/m[êe]s\s+gr[áa]tis/i.test(FONTE)).toBe(false)
  })

  it('as três saídas aparecem na ordem do §5.4: Traga agora, usar junto, me manda que eu faço', () => {
    const posTraga = FONTE.indexOf('Traga agora')
    const posJunto = FONTE.indexOf('Use o CICLO junto')
    const posManda = FONTE.indexOf('Me manda que eu faço')
    expect(posTraga).toBeGreaterThan(-1)
    expect(posJunto).toBeGreaterThan(posTraga)
    expect(posManda).toBeGreaterThan(posJunto)
  })
})
