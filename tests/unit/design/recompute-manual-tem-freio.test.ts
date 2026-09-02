import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A rota que deixa o dono recalcular o Motor de Ciclo na mão.
 *
 * Ela existe porque `client_cycles` só era escrito pelo cron, atrás do `CRON_SECRET` — quando o
 * agendador caiu (02/09, `CRON_BASE_URL` apontando para um alias morto), o produto envelheceu em
 * silêncio e ninguém tinha como consertar de dentro do app.
 *
 * Mas um botão que varre o histórico inteiro de um tenant precisa de três travas, e as três são
 * fáceis de perder numa refatoração porque nenhuma delas quebra a funcionalidade quando some:
 *
 *   · sem permissão de DONO, a recepção derruba a conta;
 *   · sem teto de taxa, o próprio dono derruba a conta segurando o botão;
 *   · com o tenant vindo do CORPO, um tenant recalcula o do vizinho.
 *
 * Comentário sai antes de casar (`semComentarios`): o arquivo guardado explica cada trava em
 * comentário, e casar com a explicação em vez do código é a armadilha nº 1 do CLAUDE.md — já
 * aconteceu duas vezes neste projeto hoje.
 */

const ROTA = join('src', 'app', 'api', 'v1', 'cycles', 'recompute', 'route.ts')

function fonte(): string {
  return semComentarios(readFileSync(ROTA, 'utf8'))
}

describe('o recálculo manual do Motor', () => {
  it('é só do dono', () => {
    // `tenant:update` não está na tabela de nenhum papel além do curinga do owner — é assim que a
    // rota de editar o negócio já restringe, e vale a mesma régua: mexe na conta inteira.
    expect(fonte(), 'a rota precisa exigir tenant:update').toMatch(
      /exigirPermissao\(\s*ctx\.papel\s*,\s*'tenant:update'\s*\)/,
    )
  })

  it('tem teto de taxa antes de tocar no banco', () => {
    const src = fonte()
    const chamada = src.match(/limitador\([^)]*\)/)
    expect(chamada, 'a rota perdeu o teto de taxa').not.toBeNull()

    // A chave por TENANT, não por usuário: o custo é do banco do tenant, e dois sócios clicando ao
    // mesmo tempo têm que dividir o mesmo teto.
    expect(chamada![0], 'a chave do limitador precisa ser por tenant').toMatch(/ctx\.tenantId/)

    // E o freio tem que vir ANTES do recálculo, senão limita depois de já ter pago o custo.
    expect(src.indexOf('limitador('), 'o limitador ficou depois do recálculo').toBeLessThan(
      src.indexOf('recomputarCiclosDoTenant('),
    )
  })

  it('recusa de verdade quando estoura o teto', () => {
    // Chamar o limitador e ignorar o resultado é o jeito mais fácil de a trava virar decoração.
    expect(fonte()).toMatch(/if\s*\(\s*!\s*\w+\.permitido\s*\)/)
  })

  it('pega o tenant do contexto validado, nunca do corpo', () => {
    const src = fonte()
    expect(src, 'tenant do corpo é a armadilha da tabela do CLAUDE.md').not.toMatch(/lerCorpo|req\.json\(\)/)
    expect(src).toMatch(/recomputarCiclosDoTenant\(\s*svc\s*,\s*ctx\.tenantId/)
  })

  it('grava na trilha de auditoria', () => {
    // Escrita em massa disparada por gente precisa deixar rastro de quem pediu.
    expect(fonte()).toMatch(/writeAudit\(/)
  })

  it('recalcula o segmento DEPOIS do ciclo, e sem derrubar o pedido', () => {
    const src = fonte()
    const ciclo = src.indexOf('recomputarCiclosDoTenant(')
    const segmento = src.indexOf('recalcularSegmentosDoTenant(')

    expect(segmento, 'o segmento não é recalculado — as listas ficariam no estado anterior').toBeGreaterThan(-1)
    expect(segmento, 'segmento antes do ciclo lê o estado velho').toBeGreaterThan(ciclo)
    // O ciclo é o que a pessoa veio buscar e já está gravado: falha no segmento não pode desfazê-lo.
    expect(src.slice(segmento), 'falha no segmento derruba o recálculo inteiro').toMatch(/\.catch\(/)
  })
})
