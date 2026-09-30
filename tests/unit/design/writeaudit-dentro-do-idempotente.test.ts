import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * BL-42 (`.claude/ciclo/autonomous-backlog.md`): em toda rota que combina `comIdempotencia` +
 * `writeAudit`, `writeAudit` FORA do fechamento que `comIdempotencia` protege fazia uma repetição
 * com a mesma `Idempotency-Key` (fila offline reenviando, toque duplo) gravar uma linha NOVA em
 * `audit_log` a cada repetição, mesmo sem repetir a mutação — a ação só aconteceu uma vez, a
 * trilha dizia duas ou mais.
 *
 * O conserto é rota por rota, de propósito (o próprio achado original avisa contra um `sed` em
 * massa) — 10 das 50 já foram corrigidas, 40 continuam pendentes. Esta guarda só afirma sobre as
 * 10 já corrigidas: garante que a próxima pessoa não move `writeAudit` de volta para fora do
 * fechamento sem perceber (ex.: numa refatoração que "simplifica" a chamada).
 *
 * **Por que casar com o CORPO do `comIdempotencia(`, delimitado por parênteses balanceados, e não
 * com "a rota inteira contém as duas strings".** A armadilha nº 1 da tabela do `CLAUDE.md`: um
 * arquivo pode ter `comIdempotencia(` e `writeAudit(` em qualquer ordem/posição e a guarda que só
 * confere presença passaria mesmo com `writeAudit` de volta depois do fechamento — que é
 * exatamente o defeito original. Delimitar pelo fim REAL da chamada (onde os parênteses fecham),
 * não por uma janela de caracteres, é a mesma disciplina de `compute-cycle`/`ainda-conta-como-
 * receita` já usada nesta base.
 */

/** As rotas já corrigidas (BL-42). Cresce conforme mais rotas forem revisadas. */
const ROTAS_CORRIGIDAS = [
  'src/app/api/v1/wallet/credit/route.ts',
  'src/app/api/v1/wallet/debit/route.ts',
  'src/app/api/v1/tickets/[id]/close/route.ts',
  'src/app/api/v1/billing/assinar/route.ts',
  'src/app/api/v1/billing/cancelar/route.ts',
  'src/app/api/v1/clients/[id]/erase/route.ts',
  'src/app/api/v1/packages/route.ts',
  'src/app/api/v1/packages/[id]/use/route.ts',
  'src/app/api/v1/inventory/entries/route.ts',
  'src/app/api/v1/clients/[id]/subscription/route.ts',
  'src/app/api/v1/clients/[id]/loyalty/route.ts',
  'src/app/api/v1/campaigns/route.ts',
  'src/app/api/v1/quotes/route.ts',
  'src/app/api/v1/clients/route.ts',
  'src/app/api/v1/appointments/[id]/complete/route.ts',
  'src/app/api/v1/appointments/[id]/arrive/route.ts',
  'src/app/api/v1/appointments/[id]/confirm/route.ts',
  'src/app/api/v1/appointments/[id]/no-show/route.ts',
  'src/app/api/v1/appointments/[id]/route.ts',
  'src/app/api/v1/appointments/route.ts',
  'src/app/api/v1/clients/[id]/notes/route.ts',
  'src/app/api/v1/clients/[id]/route.ts',
  'src/app/api/v1/clients/ja-atendo/route.ts',
  'src/app/api/v1/cycle/recover/manual/route.ts',
  'src/app/api/v1/cycle/recover/send/route.ts',
  'src/app/api/v1/products/route.ts',
  'src/app/api/v1/products/[id]/route.ts',
  'src/app/api/v1/services/route.ts',
  'src/app/api/v1/services/[id]/route.ts',
  'src/app/api/v1/services/reorder/route.ts',
  'src/app/api/v1/professionals/route.ts',
  'src/app/api/v1/professionals/[id]/route.ts',
  'src/app/api/v1/professionals/[id]/business-hours/route.ts',
  'src/app/api/v1/appointments/series/route.ts',
  'src/app/api/v1/appointments/series/[id]/cancel/route.ts',
  'src/app/api/v1/tickets/[id]/route.ts',
  'src/app/api/v1/tickets/[id]/cancel/route.ts',
  'src/app/api/v1/tickets/[id]/items/route.ts',
  'src/app/api/v1/time-off/route.ts',
  'src/app/api/v1/time-off/[id]/route.ts',
  'src/app/api/v1/account/route.ts',
  'src/app/api/v1/memberships/invite/route.ts',
  'src/app/api/v1/message-templates/route.ts',
  'src/app/api/v1/message-templates/[id]/route.ts',
  'src/app/api/v1/quotes/[id]/convert/route.ts',
  'src/app/api/v1/services/[id]/consumption/route.ts',
  'src/app/api/v1/subscription-plans/route.ts',
  'src/app/api/v1/tenant/route.ts',
  'src/app/api/v1/tenant/modules/route.ts',
  'src/app/api/v1/waitlist/route.ts',
] as const

function fonte(caminho: string): string {
  return semComentarios(readFileSync(caminho, 'utf8'))
}

/** Todas as chamadas `comIdempotencia(`, cada uma com o corpo até o parêntese que fecha ELA. */
function chamadasDeComIdempotencia(codigo: string): string[] {
  const corpos: string[] = []
  const alvo = 'comIdempotencia('
  let posicao = codigo.indexOf(alvo)
  while (posicao !== -1) {
    const abre = posicao + alvo.length - 1 // índice do '(' de abertura
    let profundidade = 1
    let i = abre + 1
    while (profundidade > 0 && i < codigo.length) {
      if (codigo[i] === '(') profundidade++
      else if (codigo[i] === ')') profundidade--
      i++
    }
    corpos.push(codigo.slice(abre, i))
    posicao = codigo.indexOf(alvo, i)
  }
  return corpos
}

describe('o leitor deste teste', () => {
  it('encontra parênteses balanceados de verdade — não só a primeira abertura', () => {
    // Guarda contra o próprio detector: uma chamada aninhada dentro de outra função (parênteses
    // dela mesma no meio) não pode fechar o corpo cedo demais.
    const exemplo = "comIdempotencia(req, {a: f(1, 2)}, () => { return g(3) })\nconst resto = 1"
    const corpos = chamadasDeComIdempotencia(exemplo)
    expect(corpos).toHaveLength(1)
    expect(corpos[0]).toContain('g(3)')
    expect(corpos[0]).not.toContain('const resto')
  })
})

describe('writeAudit mora dentro do fechamento de comIdempotencia (rotas já corrigidas)', () => {
  for (const rota of ROTAS_CORRIGIDAS) {
    it(`${rota}: toda chamada de comIdempotencia tem writeAudit no próprio corpo`, () => {
      const codigo = fonte(rota)
      const chamadas = chamadasDeComIdempotencia(codigo)
      expect(chamadas.length, `${rota} não tem nenhuma chamada de comIdempotencia — a rota mudou?`).toBeGreaterThan(0)
      for (const corpo of chamadas) {
        expect(corpo, `${rota}: uma chamada de comIdempotencia não tem writeAudit dentro do fechamento`).toContain('writeAudit(')
      }
    })
  }
})
