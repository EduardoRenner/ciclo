import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `campaigns.booked_count`/`revenue_cents` nasceram em zero e nunca tiveram escritor — o `insert`
 * deixava assim de propósito ("quem preenche é a atribuição, não o usuário") e a atribuição nunca
 * escrevia de volta. Toda campanha aparecia com receita R$ 0,00, "Marcaram horário: 0" — a tela
 * dizia ao salão que TODA campanha que ele já rodou não valeu nada, estruturalmente, para sempre.
 *
 * Migration 0054 fechou a lacuna que este teste torcia para alguém fechar (era guarda de DIREÇÃO,
 * não de proibição — ver o comentário antigo em `git log` desta linha): `messages.campaign_id`
 * agora existe, `registrarCampanha` grava, e `receitaPorCampanha` (`atribuicao.ts`) quebra por
 * campanha de verdade. O que este teste guarda agora: as colunas mortas continuam mortas (nunca
 * viraram fonte de leitura de novo, por atalho), e o número exibido vem da atribuição real.
 */
const PAGINA = semComentarios(readFileSync('src/app/admin/campanhas/page.tsx', 'utf8'))
const CRM = semComentarios(readFileSync('src/server/services/crm.ts', 'utf8'))

describe('a tela de campanhas nao inventa retorno', () => {
  it('a pagina foi lida — senao a guarda passa vazia', () => {
    expect(PAGINA.length, 'a pagina de campanhas veio vazia').toBeGreaterThan(800)
  })

  it('NAO exibe as colunas mortas de campaigns como se fossem medição', () => {
    // O que muda quando o defeito volta: voltar a mostrar booked_count/revenue_cents lidos
    // direto de `campaigns` como se fossem medição, em vez do resultado de `receitaPorCampanha`.
    expect(PAGINA, 'voltou a ler booked_count de campaigns').not.toMatch(/\.select\([^)]*booked_count/)
    expect(PAGINA, 'voltou a ler revenue_cents de campaigns').not.toMatch(/\.select\([^)]*revenue_cents/)
  })

  it('usa a atribuição de verdade, por campanha', () => {
    expect(PAGINA, 'a tela parou de usar a atribuição real por campanha').toContain('receitaPorCampanha(')
    expect(PAGINA, 'a tela parou de usar o agregado mensal do CICLO').toContain('receitaAtribuidaAoCiclo(')
  })

  it('registrarCampanha grava campaign_id nas mensagens — sem isso, receitaPorCampanha nunca acha nada', () => {
    expect(CRM, 'a mensagem da campanha parou de gravar campaign_id — a quebra por campanha volta a zerar').toMatch(/campaign_id:\s*data\.id/)
  })

  it('campaigns continua sem update — quem preenche os números é a atribuição, lida ao vivo, não um contador gravado', () => {
    /*
     * Guarda de PROIBIÇÃO agora, não mais de direção: gravar `booked_count`/`revenue_cents` de
     * volta em `campaigns` reintroduziria a classe de bug original — um número guardado que
     * diverge silenciosamente do que a atribuição calcularia ao vivo, sem cron nenhum pra
     * manter as duas contas iguais.
     */
    expect(CRM, 'apareceu um update em campaigns — os números por campanha devem continuar calculados ao vivo por receitaPorCampanha, nunca gravados').not.toMatch(
      /from\('campaigns'\)[^;]*\.update\(/,
    )
  })
})
