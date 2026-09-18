import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { CATALOGO, PLANOS } from '@/core/billing/planos'

/**
 * O irmão estreito de `precos-tem-trava-no-servidor.test.ts` — e a razão de existir separado.
 *
 * Aquela guarda lê `CARTOES` (`src/lib/planos-cartoes.ts`, a página `/precos`) para decidir quais
 * módulos são "vendidos como pagos". `club` ("Assinatura e clube") nunca entrou nos cartões — não
 * é anunciado em nenhum degrau da página de preço — mas EXISTE de verdade em `CATALOGO`/`PLANOS`
 * (só o Avançado libera), tem duas rotas de escrita implementando a funcionalidade, e nenhuma das
 * duas tinha `exigirModulo`. Achado em 2026-09-18: qualquer tenant `gratis` criava plano mensal de
 * assinatura de cliente e assinava clientes nele, de graça, pelo painel e pela API direta.
 *
 * A guarda de `CARTOES` não via isso porque nunca teve o que ver — `club` não está na lista que
 * ela lê. Esta guarda lê `CATALOGO`/`PLANOS` direto, então não depende da página de preço estar
 * em dia com o que o produto realmente vende.
 */

const ROTA_PLANOS = 'src/app/api/v1/subscription-plans/route.ts'
const ROTA_ASSINAR = 'src/app/api/v1/clients/[id]/subscription/route.ts'

function fonte(caminho: string): string {
  return readFileSync(caminho, 'utf8')
}

/** Casa com a CHAMADA (`exigirModulo(db, ctx.tenantId, 'club')`), nunca com o nome do módulo
 *  solto — `'club'` também aparece em `type Plano`/comentários por outros motivos. */
function chamaExigirModuloClub(caminho: string): boolean {
  return /exigirModulo\([^)]*,\s*'club'\)/.test(fonte(caminho))
}

describe('o clube de assinatura (club) existe de verdade e tem trava no servidor', () => {
  it('club é um módulo real, só liberado no Avançado — a premissa desta guarda', () => {
    expect(CATALOGO.some((m) => m.key === 'club'), 'club sumiu do catálogo — esta guarda precisa ser revista').toBe(true)
    expect(PLANOS.gratis.modulos, 'club entrou no Grátis — a trava de servidor deixou de fazer sentido').not.toContain('club')
    expect(PLANOS.equipe.modulos, 'club entrou no Equipe — revisar junto com o Avançado').not.toContain('club')
    expect(PLANOS.avancado.modulos, 'club saiu do Avançado — a página de preço e esta guarda precisam ser revistas').toContain('club')
  })

  it('POST /api/v1/subscription-plans (criar plano mensal) exige o módulo club', () => {
    expect(
      chamaExigirModuloClub(ROTA_PLANOS),
      `${ROTA_PLANOS} não chama exigirModulo(db, ctx.tenantId, 'club') — qualquer tenant grátis ` +
        'cria plano de assinatura mensal à vontade, o mesmo buraco achado em 18/09.',
    ).toBe(true)
  })

  it('POST /api/v1/clients/[id]/subscription (assinar cliente) exige o módulo club', () => {
    expect(
      chamaExigirModuloClub(ROTA_ASSINAR),
      `${ROTA_ASSINAR} não chama exigirModulo(db, ctx.tenantId, 'club') — qualquer tenant grátis ` +
        'assina cliente em plano mensal à vontade, o mesmo buraco achado em 18/09.',
    ).toBe(true)
  })

  it('cancelar assinatura (DELETE) continua livre — regra 5.1: cair de plano não apaga o que já existe', () => {
    // O outro lado: se alguém "consertar" travando o DELETE também, um tenant que caiu de degrau
    // fica sem conseguir cancelar a própria assinatura de um cliente — pior que o buraco original.
    const bloco = /export const DELETE[\s\S]*/.exec(fonte(ROTA_ASSINAR))?.[0] ?? ''
    expect(bloco.length, 'não achei o handler DELETE — guarda a revisar').toBeGreaterThan(0)
    expect(
      /exigirModulo\([^)]*,\s*'club'\)/.test(bloco),
      'o DELETE (cancelar) ganhou uma trava de módulo — cair de plano não pode impedir cancelar o que já existe',
    ).toBe(false)
  })
})
