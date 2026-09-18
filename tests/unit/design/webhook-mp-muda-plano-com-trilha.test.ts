import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Achado em 2026-09-18, mesma varredura de auditoria dos pacotes/carteira: `assinatura-mp.ts`
 * escreve `tenants.plan` em DOIS lugares — `processarWebhookMP` (reage ao webhook do Mercado
 * Pago) e `expirarGracaVencida` (cron que derruba assinatura pausada há 7 dias). Só o segundo
 * gravava `audit_log`, com um comentário explicando por quê ("insert direto, não `writeAudit`: o
 * cron não tem `Request` de pessoa nenhuma"). O MESMO raciocínio se aplica ao webhook — e ele não
 * tinha o insert. O evento que faz o plano de um tenant SUBIR ou CAIR de verdade, por causa de um
 * pagamento aprovado ou recusado, não deixava rastro nenhum.
 */

const ARQUIVO = 'src/server/services/assinatura-mp.ts'

function fonte(): string {
  return readFileSync(ARQUIVO, 'utf8')
}

/** Bloco de `processarWebhookMP`, isolado de `expirarGracaVencida` que vem depois no arquivo. */
function blocoWebhook(): string {
  const conteudo = fonte()
  const inicio = conteudo.indexOf('export async function processarWebhookMP')
  const fim = conteudo.indexOf('export async function expirarGracaVencida')
  return inicio >= 0 && fim > inicio ? conteudo.slice(inicio, fim) : ''
}

describe('processarWebhookMP grava audit_log quando muda o plano', () => {
  it('o bloco do webhook existe — guarda a revisar se o arquivo mudou de forma', () => {
    expect(blocoWebhook().length, 'não achei processarWebhookMP isolado de expirarGracaVencida').toBeGreaterThan(0)
  })

  it("insere em audit_log com action 'tenant.plan.change' antes de devolver plano_atualizado", () => {
    const bloco = blocoWebhook()
    expect(
      /audit_log/.test(bloco) && /action:\s*'tenant\.plan\.change'/.test(bloco),
      `${ARQUIVO}: processarWebhookMP não grava audit_log com action 'tenant.plan.change' — o ` +
        'evento que sobe ou derruba o plano por causa do Mercado Pago fica sem trilha, igual ao ' +
        'achado da mesma varredura em packages/wallet.',
    ).toBe(true)
  })
})
