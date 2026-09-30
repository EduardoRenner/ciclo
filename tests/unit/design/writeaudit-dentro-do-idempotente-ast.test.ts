import { RuleTester } from 'eslint'
import { describe, expect, it } from 'vitest'

import plugin from '../../../eslint-rules/index.mjs'

/**
 * BL-42 (`.claude/ciclo/autonomous-backlog.md`), continuação da varredura de 2026-09-28.
 *
 * `ciclo/writeaudit-dentro-do-idempotente` é a versão em AST do achado repetido rota por rota: se
 * `writeAudit(` roda DEPOIS do fechamento de `comIdempotencia(` em vez de dentro dele, uma
 * repetição com a mesma `Idempotency-Key` (fila offline reenviando, toque duplo) volta o valor
 * cacheado — pulando o fechamento inteiro — mas a chamada de `writeAudit` que ficou fora ainda
 * roda, e a rota grava uma segunda linha em `audit_log` para uma ação que só aconteceu uma vez.
 *
 * Até a rodada anterior o conserto era rota por rota, com uma lista de nomes de arquivo crescendo
 * à mão em `tests/unit/design/writeaudit-dentro-do-idempotente.test.ts` (17 de 50 rotas). Aquele
 * teste continua valendo — ele prova que as rotas JÁ corrigidas têm o padrão certo. Este aqui é
 * diferente: prova que a REGRA em si reconhece o padrão certo do errado, em qualquer arquivo,
 * existente ou futuro, sem precisar que ninguém lembre de acrescentar um nome numa lista.
 *
 * Mesmo motivo do arquivo-irmão sobre `service-client-confinado`: `pnpm lint` verde hoje prova que
 * o código de hoje não infringe, não que a regra morderia se infringisse. `RuleTester` monta o AST
 * de verdade — testar a mão seria testar a minha imaginação do parser, não o parser.
 */

const regra = plugin.rules['writeaudit-dentro-do-idempotente']
if (!regra) throw new Error('a regra `writeaudit-dentro-do-idempotente` sumiu do plugin — este arquivo inteiro passaria vazio')

const ARQUIVO_QUALQUER = 'src/app/api/v1/clients/route.ts'

function erros(codigo: string): number {
  let contagem = 0
  const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } })
  try {
    tester.run('writeaudit-dentro-do-idempotente', regra, {
      valid: [{ code: codigo, filename: ARQUIVO_QUALQUER }],
      invalid: [],
    })
  } catch {
    contagem = 1
  }
  return contagem
}

describe('writeAudit precisa estar dentro do fechamento de comIdempotencia', () => {
  it('pega o padrão errado: writeAudit DEPOIS do fechamento', () => {
    expect(
      erros(`
        const cliente = await comIdempotencia(req, ctx, async () => {
          return criarCliente(db, tenantId, entrada)
        })
        await writeAudit({ action: 'client.create' }, req)
      `),
      'writeAudit fora do fechamento é exatamente o defeito do BL-42 — a regra deixou passar',
    ).toBe(1)
  })

  it('não morde o padrão certo: writeAudit DENTRO do fechamento', () => {
    expect(
      erros(`
        const cliente = await comIdempotencia(req, ctx, async () => {
          const cliente = await criarCliente(db, tenantId, entrada)
          await writeAudit({ action: 'client.create', entityId: cliente.id }, req)
          return cliente
        })
      `),
      'a regra reprovou o próprio conserto do BL-42',
    ).toBe(0)
  })

  it('não morde comIdempotencia sem writeAudit nenhum — rota que não audita', () => {
    // Nem toda mutação tem auditoria (nem deveria ter, nesta base): a regra só existe para
    // impedir a combinação writeAudit+fora, não para exigir writeAudit em toda rota.
    expect(erros(`comIdempotencia(req, ctx, async () => criarRascunho(db))`)).toBe(0)
  })

  it('não morde chamada de função com nome parecido', () => {
    expect(erros(`outraFuncaoIdempotente(req, ctx, async () => { return 1 })`)).toBe(0)
  })

  it('pega mesmo quando há código legítimo depois do fechamento', () => {
    /*
     * appointments/[id]/complete e quotes tinham uma linha extra depois do fechamento (link de
     * avaliação, URL do orçamento) — essas são derivações do resultado já retornado e não contam
     * como o defeito. Mas se a PRÓPRIA writeAudit for essa linha extra, ainda é o defeito.
     */
    expect(
      erros(`
        const orcamento = await comIdempotencia(req, ctx, async () => criarOrcamento(db, entrada))
        await writeAudit({ action: 'quote.create', entityId: orcamento.id }, req)
        return { ...orcamento, url: montarUrl(orcamento.id) }
      `),
    ).toBe(1)
  })
})
