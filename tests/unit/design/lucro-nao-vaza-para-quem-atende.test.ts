import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios as semComentariosDe } from '../../helpers/fonte'

/**
 * `docs/48` §Fase 3, e é a única linha de risco que o plano marca em vermelho para o C1:
 *
 * > "O risco real é **social, não técnico**: C7 expõe dependência de um profissional e C1 expõe
 * > que a comissão está alta. Isso é dado sensível dentro do próprio salão — precisa de permissão
 * > por papel, nunca visível ao profissional comissionado."
 *
 * E a comanda é justamente a tela que o profissional comissionado abre todo dia (`comanda:own`).
 * O "Sobrou" dela diz, em uma subtração, quanto a comissão dele come do serviço.
 *
 * A guarda tem duas metades porque o vazamento tem dois caminhos, e o segundo é o traiçoeiro:
 *
 * 1. **A porta.** O cálculo do servidor depende de `report:read` — a mesma permissão que o caixa
 *    usa, e que `rbac.ts` nega a `professional` e a `reception`.
 * 2. **A janela.** O componente cliente recebe o `Ticket` INTEIRO, com `commission_cents`,
 *    `profit_cents`, `material_cost_cents` e `fee_cents` dentro. Trancar a porta não adianta se
 *    alguém, amanhã, mostrar `ticket.profit_cents` direto no JSX — o dado já está no navegador de
 *    quem não podia vê-lo, e nenhuma checagem de papel roda ali.
 */

const PAGINA = 'src/app/admin/comanda/[id]/page.tsx'
const TELA = 'src/app/admin/comanda/[id]/comanda.tsx'

function semComentarios(caminho: string): string {
  return semComentariosDe(readFileSync(caminho, 'utf8'))
}

/** Os números da comanda que só quem tem `report:read` pode ver. `tip_cents` não é um deles. */
const NUMEROS_DE_LUCRO = ['profit_cents', 'commission_cents', 'material_cost_cents', 'fee_cents', 'fee_bps']

describe('o lucro do atendimento não chega a quem não pode ver', () => {
  it('a leitura não voltou vazia — a guarda não passa por não ter olhado nada', () => {
    expect(semComentarios(PAGINA).length, `${PAGINA} veio vazio`).toBeGreaterThan(500)
    expect(semComentarios(TELA).length, `${TELA} veio vazio`).toBeGreaterThan(1_000)
    expect(semComentarios(TELA), 'a tela da comanda não renderiza mais o total — esta guarda precisa ser revista').toMatch(
      /ticket\.total_cents/,
    )
  })

  it('o servidor só calcula a sobra para quem tem report:read', () => {
    const src = semComentarios(PAGINA)
    expect(/avaliarPermissao\(\s*ctx\.papel\s*,\s*'report:read'\s*\)/.test(src), 'a página não confere `report:read`').toBe(true)

    // A atribuição inteira, não só a presença da variável: dar o nome `podeVerLucro` a uma
    // constante e não usá-la na decisão é exatamente o falso verde que esta guarda existe para
    // evitar.
    const atribuicao = /const sobra\s*=[\s\S]*?:\s*null/.exec(src)
    expect(atribuicao?.[0], 'a página não calcula mais `sobra` — guarda a revisar').toBeDefined()
    expect(/podeVerLucro\s*&&/.test(atribuicao![0]), 'a sobra é calculada sem depender de `podeVerLucro`').toBe(true)
  })

  it('a tela cliente não lê nenhum número de lucro direto do ticket', () => {
    const src = semComentarios(TELA)
    const vazando = NUMEROS_DE_LUCRO.filter((coluna) => new RegExp(`ticket\.${coluna}`).test(src))
    expect(
      vazando,
      'a tela da comanda lê um número de lucro direto do ticket, contornando a checagem de papel do ' +
        `servidor — o profissional comissionado passaria a ver: ${vazando.join(', ')}`,
    ).toEqual([])
  })

  it('o que a tela mostra vem da prop calculada no servidor, e ela pode ser nula', () => {
    const src = semComentarios(TELA)
    expect(/sobra:\s*SobraExplicada\s*\|\s*null/.test(src), 'a prop `sobra` deixou de poder ser nula — quem não pode ver não teria como não ver').toBe(
      true,
    )
    expect(/\{sobra\s*\?/.test(src), 'o cartão do Sobrou não é mais condicionado à prop').toBe(true)
  })
})
