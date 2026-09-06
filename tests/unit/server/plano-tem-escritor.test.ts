import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

import { ORDEM_DOS_PLANOS, PLANOS } from '@/core/billing/planos'

/**
 * L-6, `docs/31-LANCAMENTO-AUDITORIA-E-PLANO.md` — a guarda da CLASSE, não do caso.
 *
 * `tenants.plan` é a **quinta** coluna desta base com o mesmo defeito: lida por todo mundo e
 * escrita por ninguém. As quatro anteriores custaram caro justamente porque cada uma foi
 * descoberta sozinha, meses depois:
 *
 *   | Coluna | O que ficava quebrado, em silêncio |
 *   |---|---|
 *   | `tickets.fee_cents` | o quadro "Taxa" do caixa sempre zerado |
 *   | `media.consent_id` | o portfólio nunca listava nada |
 *   | `clients.referred_by` | o programa de indicação inteiro desligado da tomada |
 *   | `tenants.plan` | **11 rotas de trava de plano de pé sobre uma coluna morta** |
 *
 * O caso de `plan` é o mais caro dos quatro porque o defeito só aparece no pior momento possível:
 * no dia em que alguém PAGA. Até lá tudo parece funcionar — todo tenant nasce `gratis`, e o
 * grátis é exatamente o degrau que não precisa de escritor nenhum para se comportar direito.
 *
 * Esta guarda não casa com o nome da coluna (que aparece em migration, tipo gerado e comentário).
 * Ela casa com a ESCRITA: um `update` que grava `plan` numa linha de `tenants`.
 */

const ESCRITOR = 'scripts/promover-tenant.mjs'

function fonteDoEscritor(): string {
  return readFileSync(ESCRITOR, 'utf8')
}

describe('a leitura deste teste', () => {
  it('enxerga o escritor — não passa por não ter achado o arquivo', () => {
    expect(semComentarios(fonteDoEscritor()).length, `${ESCRITOR} veio vazio ou só com comentário`).toBeGreaterThan(400)
  })
})

describe('tenants.plan tem escritor', () => {
  it('existe um `update` que grava a coluna `plan` em `tenants`', () => {
    const codigo = semComentarios(fonteDoEscritor())

    /*
     * Casa com a cadeia inteira `.from('tenants')` … `.update({ plan …` — não com a palavra
     * `plan` solta, que aparece em `select`, em texto de ajuda e no nome da variável. Se alguém
     * apagar o `update` e deixar o resto do script, isto reprova.
     */
    expect(
      /\.from\(\s*['"]tenants['"]\s*\)[\s\S]{0,200}?\.update\(\s*\{[^}]*\bplan\b/.test(codigo),
      `${ESCRITOR} parou de escrever \`tenants.plan\`. Sem escritor, a trava de plano inteira ` +
        '(11 rotas com exigirModulo, os limites, o BloqueioPlano, a tela /admin/config/meu-plano) ' +
        'fica de pé sobre uma coluna morta — e o defeito só aparece no dia em que alguém PAGA, ' +
        'porque até lá todo tenant nasce `gratis` e o grátis não precisa de escritor. ' +
        'É a mesma classe de fee_cents, media.consent_id e clients.referred_by. Ver docs/31 §L-5.',
    ).toBe(true)
  })

  it('a escrita é conferida — `update` de zero linhas não pode passar por sucesso', () => {
    /*
     * No supabase-js um `update` que não alcança nenhuma linha devolve `data: null` com
     * `error: null`. Um script que só olha `error` diria "promovido!" sem ter promovido nada.
     * Esta base já pagou por esse defeito quatro vezes.
     */
    const codigo = semComentarios(fonteDoEscritor())
    expect(
      /if\s*\(\s*!\s*depois\s*\)/.test(codigo),
      `${ESCRITOR} não confere se o update alcançou alguma linha. No supabase-js zero linhas não ` +
        'é erro: sem essa checagem o script mente que promoveu.',
    ).toBe(true)
  })

  it('a mudança de degrau deixa trilha de auditoria', () => {
    const codigo = semComentarios(fonteDoEscritor())
    expect(
      /\.from\(\s*['"]audit_log['"]\s*\)[\s\S]{0,300}?\.insert\(/.test(codigo),
      `${ESCRITOR} mudou o degrau sem gravar em audit_log. Mudar de plano altera o que o tenant ` +
        'pode fazer e o que ele paga — é exatamente o tipo de escrita que a regra 11 manda registrar.',
    ).toBe(true)
  })
})

describe('a lista de degraus do escritor não pode divergir do catálogo', () => {
  /**
   * O script é `.mjs` e não resolve o alias `@/core/...`, então ele repete os quatro degraus à
   * mão. Duplicação vigiada é segura; duplicação silenciosa é como um degrau novo nasce
   * impossível de atribuir — o `update` recusaria o valor e ninguém saberia por quê.
   */
  function degrausDoEscritor(): string[] {
    const m = semComentarios(fonteDoEscritor()).match(/const\s+DEGRAUS\s*=\s*\[([^\]]+)\]/)
    expect(m, `não achei a lista DEGRAUS em ${ESCRITOR} — o teste precisa ser atualizado junto`).not.toBeNull()
    return (m![1] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
      .sort()
  }

  it('os degraus do escritor são exatamente os do catálogo', () => {
    expect(degrausDoEscritor()).toEqual([...ORDEM_DOS_PLANOS].sort())
  })

  it('e o catálogo tem os quatro que o produto vende — o teste não passa por comparar vazio com vazio', () => {
    expect(Object.keys(PLANOS).length).toBe(4)
    expect(degrausDoEscritor().length).toBe(4)
  })
})
