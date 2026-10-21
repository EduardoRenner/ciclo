import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/114 L-05: a página que quem foi atendido abre depois do atendimento (o link de avaliar que a
 * profissional manda) mostra a próxima vez com "Marcar agora". Nos DOIS estados: antes de dar a nota
 * e depois, porque muita gente abre o link e não avalia. O dado vem de `dadosParaAvaliar` (integração
 * `crm-inovacoes`).
 */
const TELA = semComentarios(readFileSync('src/app/(public)/avaliar/[token]/avaliar.tsx', 'utf8'))

describe('a página de avaliar sugere a próxima vez', () => {
  it('o cartão aparece antes e depois da nota', () => {
    expect((TELA.match(/<ProximaVolta /g) ?? []).length).toBe(2)
  })

  it('o botão leva ao link de marcar já com serviço e profissional', () => {
    expect(TELA).toMatch(/href=\{volta\.link\}/)
    expect(TELA).toContain('Marcar agora')
  })

  it('sem "manutenção" (direção do Vitor para a comunicação) e sem supor gênero', () => {
    const cartao = TELA.slice(TELA.indexOf('function ProximaVolta'))
    expect(cartao).not.toMatch(/manuten/i)
    expect(TELA).not.toMatch(/\bEla agenda\b/)
  })
})
