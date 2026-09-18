import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Achado em 2026-09-18, na mesma varredura que gerou o conserto do `club` e da comissão de
 * profissional: quatro rotas de DINHEIRO (`packages` POST, `wallet/credit` POST, `wallet/debit`
 * POST, `packages/[id]/use` POST) escreviam em `packages`/`wallet_entries` sem NENHUMA linha em
 * `audit_log` — nem `created_by` na tabela, nem `writeAudit` na rota. Uma venda de pacote ou um
 * crédito de carteira acontecia sem registro nenhum de QUEM fez, quando aconteceu erro (ou fraude)
 * na conta do cliente.
 *
 * Não é o mesmo achado das rotas mortas (`packages/[id]/use`/`wallet/debit` também aparecem em
 * `docs/DECISOES.md` como "inalcançáveis pela UI hoje") — esta guarda protege a trilha de
 * auditoria em SI, independente de a rota estar ou não ligada a um botão na tela: a API direta
 * sempre é um caminho possível, e dinheiro sem trilha é o tipo de lacuna que só aparece quando já
 * é tarde.
 */

const ROTAS = [
  { caminho: 'src/app/api/v1/packages/route.ts', acao: 'package.sell' },
  { caminho: 'src/app/api/v1/wallet/credit/route.ts', acao: 'wallet.credit' },
  { caminho: 'src/app/api/v1/wallet/debit/route.ts', acao: 'wallet.debit' },
  { caminho: 'src/app/api/v1/packages/[id]/use/route.ts', acao: 'package.use' },
] as const

function fonte(caminho: string): string {
  return readFileSync(caminho, 'utf8')
}

describe('venda de pacote e movimento de carteira ficam na trilha de auditoria', () => {
  for (const { caminho, acao } of ROTAS) {
    it(`${caminho} chama writeAudit com action '${acao}'`, () => {
      const conteudo = fonte(caminho)
      expect(conteudo, `${caminho} não importa writeAudit`).toMatch(/import\s*\{[^}]*writeAudit[^}]*\}\s*from\s*'@\/server\/audit\/write'/)
      expect(
        conteudo,
        `${caminho} não chama writeAudit com action: '${acao}' — o movimento de dinheiro fica sem trilha de quem fez`,
      ).toMatch(new RegExp(`action:\\s*'${acao}'`))
    })
  }
})
