import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `estado-vazio-tem-saida` cobre o estado VAZIO. Este cobre o estado de ERRO, e nas telas onde
 * quem cai nele não é o dono do salão: é a **cliente dele**, que abriu um link do WhatsApp.
 *
 * `/confirmar/[token]` terminava a tela de erro na mensagem e nada mais. Duas consequências
 * diferentes, e as duas medidas no navegador em 2026-09-03:
 *
 *   - **link recusado** (4xx): a mensagem diz "esse link não é mais válido" e a pessoa não tem
 *     ideia do que fazer. Some, o horário fica sem confirmação, e o salão conclui que ela ignorou
 *     a mensagem. Quem paga é o salão.
 *   - **rede caída** (`TypeError: Failed to fetch`): uma piscada de 4G no meio do toque levava ao
 *     MESMO beco, sem botão nenhum — e ali tentar de novo funcionaria. A única saída era ela saber
 *     recarregar a página.
 *
 * A regra do `CLAUDE.md` é que erro explique **o que fazer**, e a mensagem sozinha explica só o
 * que houve. A guarda amarra as duas metades: existe a distinção entre falha transitória e recusa,
 * e cada uma leva a uma saída própria.
 */

const TELA = 'src/app/(public)/confirmar/[token]/confirmar.tsx'
const FONTE = semComentarios(readFileSync(TELA, 'utf8'))

describe('a tela de confirmação distingue rede caída de link recusado', () => {
  it('o `catch` de rede marca a falha como transitória', () => {
    // Casa com a CHAMADA e o argumento, não com o nome da função solto: `falhou` aparece na
    // declaração, e casar com o nome deixaria a guarda verde com os dois ramos colapsados.
    expect(/\.catch\(\(\)\s*=>\s*falhou\([^)]*,\s*true\)\)/.test(FONTE), 'a queda de rede não é mais transitória').toBe(true)
  })

  it('a recusa do servidor NÃO é transitória, e 5xx é', () => {
    /*
     * O critério tem que ser o STATUS, não "deu erro". Se tudo virar transitório, a tela oferece
     * "tentar de novo" para um link que o servidor já recusou — botão que só repete a recusa, que
     * é a forma mais irritante de dizer não. Se nada virar, volta o beco da rede.
     */
    expect(/falhou\([^)]*,\s*r\.status\s*>=\s*500\)/.test(FONTE), 'o ramo do servidor não olha o status').toBe(true)
    expect(/falhou\([^)]*,\s*true\s*\)/.test(FONTE), 'nenhum ramo é transitório').toBe(true)
  })

  it('as duas ações da tela tratam a falha do mesmo jeito', () => {
    // Confirmar e desmarcar são caminhos irmãos; consertar um só é como o defeito nasce de novo.
    expect((FONTE.match(/falhou\(/g) ?? []).length, 'algum ramo de falha ficou sem passar por `falhou`').toBeGreaterThanOrEqual(4)
  })
})

describe('o estado de erro tem saída para a cliente do salão', () => {
  const iErro = FONTE.lastIndexOf('Não deu certo')
  const bloco = FONTE.slice(iErro)

  it('encontrou o bloco de erro — não passa por não ter olhado nada', () => {
    expect(iErro, 'sumiu a tela de erro').toBeGreaterThan(-1)
    expect(bloco.length).toBeGreaterThan(100)
  })

  it('falha transitória oferece tentar de novo', () => {
    expect(/podeTentarDeNovo\s*\?/.test(bloco), 'o erro não distingue o caso que dá para repetir').toBe(true)
    expect(/Tentar de novo/.test(bloco), 'sumiu o botão de repetir').toBe(true)
  })

  it('recusa definitiva diz o que fazer, e não só o que houve', () => {
    /*
     * O conceito, não a redação: a saída precisa apontar para uma PESSOA, porque o produto não
     * sabe o slug do salão neste estado (o token foi recusado, então não há de onde tirar). Um
     * link para lugar nenhum seria pior que a orientação em texto.
     */
    const semRetentativa = bloco.slice(bloco.indexOf(') : ('))
    expect(/whatsapp|chame|fale/i.test(semRetentativa), 'o ramo sem retentativa não diz o que fazer').toBe(true)
  })

  it('o botão de repetir volta para a escolha, em vez de repetir a chamada sozinho', () => {
    // Voltar ao estado 'escolhendo' é o certo: a pessoa pode ter mudado de ideia entre confirmar e
    // desmarcar enquanto a rede estava fora, e refazer a ação anterior por conta própria decidiria
    // por ela.
    expect(/setEstado\('escolhendo'\)/.test(bloco), 'o retry não devolve a escolha para a pessoa').toBe(true)
  })
})
