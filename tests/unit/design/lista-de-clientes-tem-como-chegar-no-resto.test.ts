import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A carteira inteira não cabia na tela e não havia como chegar no resto.
 *
 * `listarClientes` tem cursor desde sempre (`.lt('id', cursor)`, ordem por `id` desc) e
 * `/api/v1/clients` já aceitava `cursor` — só a TELA nunca ligou. O efeito medido: o cabeçalho
 * anunciava "437 na carteira", a lista trazia 50, e as outras 387 só existiam para quem soubesse
 * o nome de cor. E o cartão de limite de plano, na MESMA tela, mostrava o total verdadeiro: dois
 * números que se contradiziam lado a lado, sem uma palavra de explicação.
 *
 * A guarda vigia as duas metades que quebram sozinhas:
 *
 * 1. **a tela pede a próxima página** — se o cursor sair daqui, o defeito volta inteiro;
 * 2. **o tamanho de página dos dois lados é o MESMO número.** É por ele que a tela decide se há
 *    mais (página cheia) ou acabou (página curta). Se o serviço mudar o padrão para 100 e a tela
 *    seguir com 50, o botão some com 50 clientes restantes; se for ao contrário, ele fica para
 *    sempre prometendo uma página que não existe. Nenhum dos dois dá erro.
 */

const TELA = semComentarios(readFileSync('src/app/admin/clientes/lista.tsx', 'utf8'))
const SERVICO = semComentarios(readFileSync('src/server/services/clientes.ts', 'utf8'))
const ROTA = semComentarios(readFileSync('src/app/api/v1/clients/route.ts', 'utf8'))

describe('a lista de clientes não esconde a carteira', () => {
  it('a tela pede a próxima página pelo cursor', () => {
    // Casa com o USO, não com o nome: `cursor` sozinho apareceria numa assinatura de tipo.
    expect(TELA).toMatch(/p\.set\('cursor'/)
    expect(TELA).toContain('carregarMais')
  })

  it('a rota repassa o cursor — sem isso a tela pede e o servidor ignora', () => {
    expect(ROTA).toMatch(/params\.get\('cursor'\)/)
  })

  it('o tamanho de página da tela é o MESMO do padrão do serviço', () => {
    const naTela = /const PAGINA = (\d+)/.exec(TELA)?.[1]
    const noServico = /opcoes\.limite \?\? (\d+)/.exec(SERVICO)?.[1]

    // Se qualquer um dos dois padrões deixar de casar, isto grita em vez de passar vazio.
    expect(naTela, 'não achei `const PAGINA` em lista.tsx').toBeDefined()
    expect(noServico, 'não achei o padrão de `limite` em clientes.ts').toBeDefined()
    expect(naTela).toBe(noServico)
  })

  it('o botão desaparece no fim da lista, em vez de prometer página que não existe', () => {
    // `fim` nasce da comparação com PAGINA e some o botão; sem ele o botão fica para sempre.
    expect(TELA).toMatch(/setFim\([^)]*\.length < PAGINA\)/)
    expect(TELA).toMatch(/!fim &&/)
  })
})
