import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * As duas rotas que rodam SOZINHAS em produção (`recompute-cycles`, `segments`, a cada 3h pelo
 * cron-job.org) varrem TODOS os tenants num laço. Até 2026-09-10 o `await` do laço estava solto:
 * o primeiro tenant com dado malformado (fuso que `dataLocalDe` não parseia, atendimento sem
 * serviço) lançava, o laço abortava, e todo tenant depois dele ficava sem recálculo — neste
 * disparo e em todos os outros, até alguém consertar aquele tenant.
 *
 * É o silêncio dos dias 25/26/08 (`motor-de-ciclo-observavel.test.ts`) por outra porta: o
 * diferencial que sustenta o preço do produto parado para quase todo mundo por causa de um. O
 * `/api/health` só acusa depois de 26h, e só se a falha for total.
 *
 * O conserto: `try` por tenant, `falhas++` no `catch`, log estruturado (vai ao Sentry) e
 * `tenantsComFalha` no corpo (o cron-job.org guarda a resposta).
 *
 * Guarda de fonte, assumida como tal — casa com a ESTRUTURA do laço, não com um nome solto.
 */

/*
 * `campaigns` e `lgpd-retention` já tinham `try` por item desde que foram escritas — mas "já tinha
 * `try`" não era a mesma coisa que "já contava e expunha a falha": a auditoria de armadilhas
 * catalogadas de 2026-09-28 achou que `campaigns/route.ts` tinha o `try/catch` mas o `catch` só
 * logava, sem `falhas++` nem `tenantsComFalha` no corpo — o mesmo defeito que este arquivo existe
 * para pegar, só que sem guarda nenhuma cobrindo. Corrigido e incluído na lista abaixo. `lgpd-
 * retention` usa `falhas.push(id)`/`falhas: falhas.length` (padrão ligeiramente diferente, arranjo
 * de lista em vez de contador) e por isso não casa com o regex genérico daqui — conferido à mão,
 * está correto, mas não cabe nesta lista sem reescrever os regex para os dois formatos.
 */
const ROTAS = [
  { arquivo: 'src/app/api/cron/recompute-cycles/route.ts', servico: 'recomputarCiclosDoTenant' },
  { arquivo: 'src/app/api/cron/segments/route.ts', servico: 'recalcularSegmentosDoTenant' },
  { arquivo: 'src/app/api/cron/stock-alerts/route.ts', servico: 'listarAlertasDeEstoque' },
  { arquivo: 'src/app/api/cron/campaigns/route.ts', servico: 'executarCampanhaDiaria' },
]

describe('um tenant com erro não derruba o Motor de Ciclo para os outros', () => {
  for (const { arquivo, servico } of ROTAS) {
    describe(arquivo, () => {
      const fonte = semComentarios(readFileSync(arquivo, 'utf8'))

      it('a leitura não voltou vazia', () => {
        expect(fonte.length, `${arquivo} veio vazio`).toBeGreaterThan(300)
        expect(fonte).toContain(servico)
      })

      it('a chamada do serviço está dentro de um try/catch no laço de tenants', () => {
        const laco = fonte.slice(fonte.indexOf('for (const tenant of'))
        expect(laco, 'não achei o laço de tenants').toContain(servico)

        const iTry = laco.indexOf('try')
        const iChamada = laco.indexOf(`${servico}(`)
        const iCatch = laco.indexOf('catch')
        expect(iTry, 'o laço não tem `try`').toBeGreaterThan(-1)
        expect(iTry, 'o `try` vem DEPOIS da chamada — não protege nada').toBeLessThan(iChamada)
        expect(iCatch, 'o `try` do laço não tem `catch`').toBeGreaterThan(iChamada)
      })

      it('o catch conta a falha em vez de engolir em silêncio', () => {
        expect(fonte, 'o catch não incrementa `falhas`').toMatch(/catch[\s\S]{0,120}falhas\s*\+\+/)
        expect(fonte, 'a falha não é registrada no log').toMatch(/console\.error\([\s\S]{0,200}tenant_falhou/)
      })

      it('o corpo da resposta expõe quantos tenants falharam', () => {
        expect(fonte).toMatch(/tenantsComFalha:\s*falhas/)
      })
    })
  }
})
