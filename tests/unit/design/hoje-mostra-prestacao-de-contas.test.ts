import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `docs/45` §1.4 (Blue Ocean, quadrante CRIAR): a prestação de contas do Motor é o único recurso
 * que nenhum dos seis concorrentes pesquisados tem — e `docs/48` marcou como a fraqueza dele
 * "Dono ENXERGA sem explicação? Não". Ela morava só em `/admin/recuperar` e no resumo de
 * `/admin/mes`, telas que o dono abre por escolha. Esta guarda existe para o dia em que alguém
 * remover o teaser de `/admin/hoje` (a tela que se abre sozinha) achando que é redundante com a
 * explicação completa que já existe lá — as duas cumprem papéis diferentes, e o comentário de
 * `prestacao-teaser.tsx` explica por quê.
 */
const PAGE = 'src/app/admin/hoje/page.tsx'
const HOJE = 'src/app/admin/hoje/hoje.tsx'

describe('Hoje mostra a manchete da prestação de contas do Motor', () => {
  const page = semComentarios(readFileSync(PAGE, 'utf8'))
  const hoje = semComentarios(readFileSync(HOJE, 'utf8'))

  it('as leituras não voltaram vazias', () => {
    expect(page.length).toBeGreaterThan(500)
    expect(hoje.length).toBeGreaterThan(500)
  })

  it('a página busca a prestação de contas do tenant e não engole falha em silêncio', () => {
    expect(page).toMatch(/prestacaoDeContasDoMotor\(/)
    expect(page).toMatch(/prestacaoDeContasDoMotor\([\s\S]{0,80}\.catch\(/)
  })

  it('a página passa a prestação de contas para o componente Hoje', () => {
    expect(page).toMatch(/<Hoje[\s\S]{0,300}prestacaoDeContas=\{prestacaoDeContas\}/)
  })

  it('o componente Hoje desenha o teaser', () => {
    expect(hoje).toMatch(/<PrestacaoTeaser contas=\{prestacaoDeContas\}/)
  })

  it('o detector reconhece o defeito que ele impede', () => {
    const semTeaser = 'export default function Hoje({ resumo }: { resumo: unknown }) { return <div>{resumo}</div> }'
    expect(/<PrestacaoTeaser contas=\{prestacaoDeContas\}/.test(semTeaser)).toBe(false)
  })
})
