import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `campaigns.booked_count` e `campaigns.revenue_cents` nascem em zero e NINGUEM escreve nelas —
 * nao existe um unico `update` em `campaigns` no repositorio. O `insert` deixa assim de proposito
 * ("quem preenche e a atribuicao, nao o usuario") e a atribuicao nunca escreveu de volta.
 *
 * O efeito nao era um funil decorativo, era pior: toda campanha aparecia com receita R$ 0,00,
 * "Marcaram horario: 0" e "Cada mensagem valeu R$ 0,00 em media". A tela dizia ao salao que TODA
 * campanha que ele ja rodou nao valeu nada — estruturalmente, para sempre.
 *
 * O numero de verdade e `receitaAtribuidaAoCiclo`, que casa mensagem de campanha enviada com
 * atendimento concluido na janela e e a mesma funcao em que a tela "Hoje" confia. Ela nao separa
 * por campanha porque `messages` nao guarda de qual campanha a linha saiu.
 */
const PAGINA = semComentarios(readFileSync('src/app/admin/campanhas/page.tsx', 'utf8'))
const CRM = semComentarios(readFileSync('src/server/services/crm.ts', 'utf8'))

describe('a tela de campanhas nao inventa retorno', () => {
  it('a pagina foi lida — senao a guarda passa vazia', () => {
    expect(PAGINA.length, 'a pagina de campanhas veio vazia').toBeGreaterThan(800)
  })

  it('NAO exibe as colunas que ninguem escreve', () => {
    // O que muda quando o defeito volta: voltar a mostrar booked_count/revenue_cents como se
    // fossem medicao.
    expect(PAGINA, 'voltou a exibir booked_count, que ninguem escreve').not.toContain('booked_count')
    expect(PAGINA, 'voltou a exibir revenue_cents, que ninguem escreve').not.toContain('revenue_cents')
  })

  it('usa a atribuicao de verdade no lugar', () => {
    expect(PAGINA, 'a tela parou de usar o numero real da atribuicao').toContain('receitaAtribuidaAoCiclo(')
  })

  it('continua ninguem escrevendo em campaigns — se alguem escrever, a tela pode voltar a ler', () => {
    /*
     * Guarda de direcao, nao de proibicao. No dia em que existir um escritor de booked_count (a
     * atribuicao gravando de volta, ou `messages` ganhando `campaign_id`), este teste reprova e
     * quem estiver mexendo LE este comentario: a partir dali a tela PODE voltar a mostrar o numero
     * por campanha, e as duas asercoes acima e que precisam mudar.
     */
    expect(CRM, 'apareceu um update em campaigns — reveja a tela, ela pode voltar a medir por campanha').not.toMatch(
      /from\('campaigns'\)[^;]*\.update\(/,
    )
  })
})
