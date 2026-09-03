import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { SLUGS_DE_DEMONSTRACAO_PARA_TESTE, SLUGS_DE_VITRINE } from '@/core/tenants/demonstracao'

import { semComentarios } from '../../helpers/fonte'

/**
 * "Ver uma página de exemplo" é a prova de produto da landing — o argumento mais forte que o CICLO
 * tem para quem nunca ouviu falar dele. Em 2026-09-03 ele apontava, em `href` literal, para
 * `/dom-rocha`: **404 em produção**, medido por requisição ao site no ar.
 *
 * O que tinha acontecido: a demonstração migrou para os seis tenants de
 * `scripts/seed-demo-6-negocios.mjs` e o link ficou no antigo. Nenhuma guarda podia pegar isso
 * lendo código, porque **o defeito não estava no código** — estava na distância entre o código e o
 * banco. Só uma pergunta em tempo de execução responde, e é por isso que a landing passou a
 * resolver o destino no servidor.
 *
 * Esta guarda protege as duas metades do conserto:
 *   1. a landing não pode voltar a datilografar um slug de tenant;
 *   2. a lista de VITRINE (o que mostrar) não pode voltar a se confundir com a de DEMONSTRAÇÃO
 *      (o que esconder do buscador) — foi essa confusão que, na primeira tentativa, fez o botão
 *      apontar para `/teste-essencial`, uma conta de teste de degrau de plano.
 */

const HOME = 'src/app/page.tsx'

describe('a landing resolve a vitrine no servidor, e não no código', () => {
  it('nenhum slug de tenant datilografado na home', () => {
    /*
     * Comentário some antes de casar: a home EXPLICA em prosa que `/dom-rocha` respondia 404, e
     * casar com a explicação reprovaria a documentação que impede o defeito de voltar — a armadilha
     * nº 1 da tabela de guarda cega do `CLAUDE.md`.
     */
    const fonte = semComentarios(readFileSync(HOME, 'utf8'))
    const datilografados = [...SLUGS_DE_DEMONSTRACAO_PARA_TESTE, ...SLUGS_DE_VITRINE].filter((slug) =>
      fonte.includes(slug),
    )
    expect(
      [...new Set(datilografados)],
      'a home voltou a escrever um slug de tenant à mão. Isso quebra em silêncio no dia em que o ' +
        'tenant sumir do banco — que é exatamente o que aconteceu com `/dom-rocha` em produção. ' +
        'Use `slugDeDemonstracaoNoAr()`.',
    ).toEqual([])
  })

  it('a home pergunta ao servidor qual vitrine está no ar', () => {
    // Casa com a CHAMADA, não com o import: importar e não usar é o estado em que o defeito volta.
    const fonte = semComentarios(readFileSync(HOME, 'utf8'))
    expect(/slugDeDemonstracaoNoAr\s*\(/.test(fonte), 'a home não resolve mais a vitrine no servidor').toBe(true)
  })

  it('o botão some quando não há vitrine, em vez de apontar para lugar nenhum', () => {
    // A alternativa que este conserto recusa: `href={slug ?? '/algum-padrao'}`. Um argumento a
    // menos é pior que um argumento; um link para 404 é pior que os dois.
    const fonte = semComentarios(readFileSync(HOME, 'utf8'))
    expect(/slugDeExemplo\s*\?/.test(fonte), 'a home não trata mais o caso de não haver vitrine').toBe(true)
  })
})

describe('vitrine e demonstração são listas diferentes, e a diferença importa', () => {
  it('toda vitrine também está na lista de demonstração', () => {
    /*
     * O invariante que não pode quebrar: a lista de demonstração é a que tira o tenant do
     * `sitemap`, do `robots` e da mensageria real. Mostrar como exemplo alguém que o buscador
     * indexa como negócio de verdade é o defeito que `demonstracao.ts` foi criado para impedir.
     */
    const foraDaExclusao = SLUGS_DE_VITRINE.filter((s) => !SLUGS_DE_DEMONSTRACAO_PARA_TESTE.includes(s))
    expect(
      foraDaExclusao,
      'estes slugs são mostrados como exemplo e NÃO estão marcados como demonstração — o sitemap ' +
        'os entregaria ao buscador como estabelecimento real.',
    ).toEqual([])
  })

  it('a vitrine é um subconjunto PRÓPRIO — não virou a lista de exclusão de novo', () => {
    /*
     * A regressão específica que aconteceu: usar a lista de exclusão como lista de exibição
     * entrega o pior candidato (uma conta `teste-*` de degrau de plano), não o melhor. Se as duas
     * listas voltarem a ter o mesmo tamanho, é porque alguém as colapsou.
     */
    expect(
      SLUGS_DE_VITRINE.length,
      'as duas listas têm o mesmo tamanho, ou seja alguém as colapsou. A de exclusão responde "o ' +
        'que esconder do buscador" e inclui contas internas de teste de plano; usá-la como lista ' +
        'de exibição faz a home mostrar `/teste-essencial` como exemplo do produto.',
    ).toBeLessThan(SLUGS_DE_DEMONSTRACAO_PARA_TESTE.length)
    for (const interna of ['teste-essencial', 'teste-equipe', 'teste-avancado']) {
      expect(SLUGS_DE_VITRINE, `${interna} é conta de teste de plano e não pode ser vitrine`).not.toContain(interna)
    }
  })

  it('a vitrine não está vazia — senão o botão some para sempre e nada reprova', () => {
    expect(SLUGS_DE_VITRINE.length).toBeGreaterThan(0)
  })
})
