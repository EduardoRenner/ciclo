import { RuleTester } from 'eslint'
import { describe, expect, it } from 'vitest'

import plugin from '../../../eslint-rules/index.mjs'

/**
 * Regra 11 do CLAUDE.md: "Nunca delete agendamento, movimento de estoque ou registro de
 * auditoria. Use estado/compensação."
 *
 * A migration `0081` já trava `DELETE` nessas tabelas por RLS (`tests/rls/append-only-nao-se-
 * apaga.test.ts` prova isso contra Postgres real) — mas só para quem usa o cliente do USUÁRIO.
 * `service_role` (`withTenant`/`withNovoTenant`, o caminho que a maioria do código de servidor
 * usa) ignora RLS por desenho — `BYPASSRLS`, confirmado nesta sessão ao investigar um bug
 * diferente. A mesma linha que o teste de RLS prova bloqueada passaria direto num caminho de
 * `service_role`. `ciclo/sem-delete-em-tabela-append-only` fecha essa porta no CÓDIGO-FONTE, antes
 * do banco — segunda camada, não substituta da primeira.
 */

const regra = plugin.rules['sem-delete-em-tabela-append-only']
if (!regra) throw new Error('a regra `sem-delete-em-tabela-append-only` sumiu do plugin — este arquivo inteiro passaria vazio')

const ARQUIVO_QUALQUER = 'src/server/services/qualquer.ts'

function erros(codigo: string): number {
  let contagem = 0
  const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } })
  try {
    tester.run('sem-delete-em-tabela-append-only', regra, {
      valid: [{ code: codigo, filename: ARQUIVO_QUALQUER }],
      invalid: [],
    })
  } catch {
    contagem = 1
  }
  return contagem
}

describe('nunca DELETE em tabela append-only', () => {
  it('pega .delete() em appointments', () => {
    expect(erros("db.from('appointments').delete().eq('id', id)"), 'delete em appointments não foi pego').toBe(1)
  })

  it('pega .delete() em stock_moves', () => {
    expect(erros("db.from('stock_moves').delete().eq('id', id)")).toBe(1)
  })

  it('pega .delete() em audit_log', () => {
    expect(erros("db.from('audit_log').delete().eq('id', id)")).toBe(1)
  })

  it('pega .delete() em cycle_predictions e package_uses — mesmo princípio append-only', () => {
    expect(erros("db.from('cycle_predictions').delete().eq('id', id)")).toBe(1)
    expect(erros("db.from('package_uses').delete().eq('id', id)")).toBe(1)
  })

  it('não morde .delete() em tabela NÃO protegida — regra 11 não veta apagar tudo', () => {
    // client_notes, time_off, message_templates etc. já têm DELETE de verdade nesta base
    // (removível por design) — a regra tem que ficar restrita às tabelas nomeadas.
    expect(erros("db.from('time_off').delete().eq('id', id)"), 'a regra mordeu uma tabela que TEM DELETE de verdade').toBe(0)
  })

  it('não morde .update() nas mesmas tabelas — estado/compensação é o caminho certo', () => {
    expect(erros("db.from('appointments').update({ status: 'canceled' }).eq('id', id)"), 'a regra mordeu um UPDATE, que é exatamente o padrão que ela pede').toBe(0)
  })

  it('não morde .delete() sem .from() — não dá pra saber a tabela, reprovar seria adivinhar', () => {
    expect(erros('algumaColecao.delete(id)'), 'sem `.from(\'tabela\')` não há como confirmar a tabela').toBe(0)
  })

  it('não morde .from() com nome de tabela vindo de variável — mesma razão', () => {
    expect(erros("db.from(NOME_DA_TABELA).delete().eq('id', id)"), 'nome de tabela dinâmico não dá pra verificar por AST — reprovar seria adivinhar').toBe(0)
  })
})
