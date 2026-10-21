import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * APR-218 (docs/98 B-16b, G-17): o push "novo pedido de agendamento" era `void notificarEquipe(…)` —
 * uma promessa solta que a Vercel pode descartar ao congelar a instância depois da resposta. A
 * chamada precisa estar DENTRO de `agendarDepois(() => …)`, que usa o `after()` do Next.
 * Casa com a CHAMADA (`agendarDepois(() =>` seguido de `notificarEquipe(` antes de fechar), não com
 * o nome — o nome aparece também na linha de import.
 */
describe('o aviso de horário novo para a equipe sobrevive à resposta (APR-218)', () => {
  it('`notificarEquipe(` do agendamento público está dentro de `agendarDepois(() =>`', () => {
    const src = semComentarios(readFileSync('src/server/services/public-booking.ts', 'utf8'))
    const chamadas = [...src.matchAll(/notificarEquipe\(/g)].map((m) => m.index!)
    expect(chamadas.length, 'o agendamento público deixou de avisar a equipe').toBeGreaterThan(0)
    for (const i of chamadas) {
      const antes = src.slice(Math.max(0, i - 80), i)
      expect(/agendarDepois\(\(\) =>\s*$/.test(antes), `notificarEquipe( em ${i} está fora de agendarDepois(() =>`).toBe(true)
    }
  })

  /*
    docs/112 EXP-A03: cancelar pelo link liberava a vaga sem avisar ninguém. A rota passou a avisar,
    e o aviso tem que vir DEPOIS de cancelar (avisar e falhar ao cancelar seria mentir) e dentro de
    `agendarDepois`, pelo mesmo motivo do APR-218.
  */
  it('cancelar pelo link avisa a equipe, depois de cancelar e dentro de `agendarDepois(() =>`', () => {
    const src = semComentarios(readFileSync('src/app/api/v1/public/appointments/cancel/[token]/route.ts', 'utf8'))
    const iCancela = src.indexOf('await cancelarAgendamento(')
    const iAvisa = src.indexOf('notificarEquipe(')
    expect(iCancela, 'a rota não cancela mais: a guarda ficou sem objeto').toBeGreaterThan(-1)
    expect(iAvisa, 'cancelar pelo link deixou de avisar a equipe').toBeGreaterThan(-1)
    expect(iAvisa, 'o aviso sai antes de o cancelamento acontecer').toBeGreaterThan(iCancela)
    const antes = src.slice(Math.max(0, iAvisa - 80), iAvisa)
    expect(/agendarDepois\(\(\) =>\s*$/.test(antes), 'notificarEquipe( fora de agendarDepois(() =>').toBe(true)
  })

  it('`agendarDepois` usa o `after()` do Next, não um `void` disfarçado', () => {
    const src = semComentarios(readFileSync('src/server/http/depois.ts', 'utf8'))
    expect(/\bafter\(\(\) => tarefa\(\)\)/.test(src)).toBe(true)
  })
})
