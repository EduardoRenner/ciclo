import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Duas regressões diferentes, do mesmo lugar: a tela que a CLIENTE usa para marcar.
 *
 * 1. O preço do serviço aparecia duas vezes na mesma rolagem — na linha do serviço e de novo, em
 *    corpo grande, no resumo logo abaixo. O último passo antes de confirmar virava vitrine de
 *    preço em vez de nome + telefone + confirmar.
 * 2. O card de serviço da página do salão era `pressionavel` (retorno de toque, `hover`, tudo)
 *    dentro de uma `div` inerte: a pessoa tocava no serviço que queria e não acontecia nada.
 *
 * As duas passam despercebidas por teste de comportamento — a tela funciona, só atrapalha. Por
 * isso são guarda de varredura. Comentário sai antes de casar (`semComentarios`): este arquivo
 * fala de preço o tempo todo, e o arquivo guardado explica em comentário por que o preço não se
 * repete — casar com a explicação em vez do código é a armadilha nº1 da tabela do CLAUDE.md.
 */

const AGENDAR = join('src', 'app', '(public)', '[slug]', 'agendar', 'agendar.tsx')
const SECOES = join('src', 'app', '(public)', '[slug]', 'secoes.tsx')

function fonte(caminho: string): string {
  return semComentarios(readFileSync(caminho, 'utf8'))
}

describe('a tela de agendamento da cliente', () => {
  it('formata o preço do serviço uma vez só', () => {
    const src = fonte(AGENDAR)
    const ocorrencias = src.match(/priceCents\s*\/\s*100/g) ?? []

    /*
     * Exatamente 1, nunca "no máximo 1": se alguém renomear o campo e o padrão parar de casar,
     * zero tem que REPROVAR. Guarda que passa vazia é guarda que ninguém sabe se funciona.
     */
    expect(
      ocorrencias.length,
      `o preço do serviço é formatado ${ocorrencias.length}x em ${AGENDAR} — deve ser exatamente 1 (a linha do serviço). ` +
        'Se o campo mudou de nome, atualize este guarda junto.',
    ).toBe(1)
  })

  it('o sinal continua sendo mostrado, e é outro número', () => {
    // Sem isto, apagar o bloco de sinal inteiro deixaria o teste acima verde — o resumo perderia
    // a única informação de dinheiro que ele DEVE dar, e ninguém saberia.
    expect(fonte(AGENDAR)).toMatch(/depositCents\s*\/\s*100/)
  })
})

describe('a lista de serviços da página do salão', () => {
  it('leva ao agendamento com o serviço já escolhido', () => {
    const src = fonte(SECOES)
    const lista = src.slice(src.indexOf('perfil.services.map('))

    expect(lista.length, `${SECOES} não tem mais a lista de serviços`).toBeGreaterThan(0)
    expect(
      lista,
      'tocar num serviço tem que levar para /<slug>/agendar?servico=<id> — sem isso o card volta a ser um alvo de toque que não faz nada',
    ).toMatch(/agendar\?servico=\$\{s\.id\}/)
  })

  it('o servidor confere o id antes de escolher por ela', () => {
    // `?servico=` vem da URL: id de outro salão ou serviço desativado não pode virar estado.
    const page = fonte(join('src', 'app', '(public)', '[slug]', 'agendar', 'page.tsx'))
    expect(page).toMatch(/perfil\.services\.some\(/)
  })
})
