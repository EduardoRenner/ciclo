import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Achado em 2026-09-18, na mesma varredura módulo↔tela que gerou o conserto do `club`.
 *
 * `team` ("Equipe e comissão") é gated em UM ponto antes deste conserto: `professionals/[id]/
 * business-hours/route.ts`, e só condicionalmente (`professionalId !== null`). `PATCH /api/v1/
 * professionals/[id]` aceita `compModel`/`commissionBps` no mesmo corpo que nome, cor e avatar —
 * sem checagem de módulo nenhuma, condicional ou não.
 *
 * Severidade BAIXA (não ALTA como o `club`): sem caminho de UI hoje (nenhuma tela do painel edita
 * comissão), e o teto de `maxProfissionais: 1` do Grátis/Essencial já limita o impacto prático —
 * comissão só importa para pagar OUTRA pessoa. Ainda assim, é o mesmo formato de buraco: rota
 * direta sem trava de servidor.
 *
 * O conserto é CONDICIONAL, de propósito — travar a rota inteira travaria renomear o próprio
 * profissional (nome, cor, avatar), que não é feature paga. Só quando `compModel`/`commissionBps`
 * vêm no corpo é que o módulo `team` é exigido, mesmo padrão do `professionalId !== null` em
 * `business-hours/route.ts`.
 */

const ROTA = 'src/app/api/v1/professionals/[id]/route.ts'

function fonte(): string {
  return readFileSync(ROTA, 'utf8')
}

/** Bloco do handler PATCH, isolado do DELETE que vem depois no mesmo arquivo. */
function blocoPatch(): string {
  const conteudo = fonte()
  const inicio = conteudo.indexOf('export const PATCH')
  const fim = conteudo.indexOf('export const DELETE')
  return inicio >= 0 && fim > inicio ? conteudo.slice(inicio, fim) : ''
}

describe('PATCH /api/v1/professionals/[id] trava comissão atrás do módulo team', () => {
  it('o handler PATCH existe — guarda a revisar se o arquivo mudou de forma', () => {
    expect(blocoPatch().length, 'não achei o handler PATCH isolado do DELETE').toBeGreaterThan(0)
  })

  it('chama exigirModulo(db, ctx.tenantId, \'team\') dentro do PATCH', () => {
    expect(
      /exigirModulo\([^)]*,\s*'team'\)/.test(blocoPatch()),
      `${ROTA} não chama exigirModulo(db, ctx.tenantId, 'team') no PATCH — qualquer tenant grátis ` +
        'configura comissão de profissional à vontade pela API direta.',
    ).toBe(true)
  })

  it('a chamada é CONDICIONAL a compModel/commissionBps, não incondicional', () => {
    // Se a checagem estivesse fora de qualquer `if` que mencione os dois campos, travaria também
    // renomear o próprio profissional (nome, cor, avatar) sem o módulo team — pior que o buraco
    // original, porque nome não é feature paga.
    const bloco = blocoPatch()
    const exigirIdx = bloco.search(/exigirModulo\([^)]*,\s*'team'\)/)
    expect(exigirIdx, 'não achei a chamada exigirModulo para isolar o if ao redor').toBeGreaterThan(-1)

    const antes = bloco.slice(0, exigirIdx)
    const ifIdx = antes.lastIndexOf('if')
    expect(ifIdx, 'não achei um if antes da chamada — a trava parece incondicional').toBeGreaterThan(-1)

    const condicao = antes.slice(ifIdx)
    expect(
      /compModel/.test(condicao) && /commissionBps/.test(condicao),
      'o if ao redor da trava não menciona compModel/commissionBps — pode estar travando a rota inteira',
    ).toBe(true)
  })
})
