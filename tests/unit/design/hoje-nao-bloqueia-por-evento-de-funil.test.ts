import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Achado em 2026-09-14, medindo latência real de `/admin/hoje` (não estimando): o comentário já
 * dizia "`registrarPrimeiraOcorrencia` nunca lança e não bloqueia a tela", mas o código fazia
 * `await registrarPrimeiraOcorrencia(...)` DEPOIS do `Promise.all` de cima — uma ida de rede extra
 * (SELECT em `product_events`) no caminho crítico de toda visita a "Hoje" em qualquer tenant onde
 * o Motor de Ciclo já atribuiu receita (a maioria dos ativos). Comentário e código diziam coisas
 * diferentes; o comentário estava certo sobre a INTENÇÃO, não sobre o que rodava.
 *
 * `after()` (Next.js) resolve isso de verdade: o callback só roda depois da resposta já ter sido
 * enviada. Esta guarda casa com o USO — `after(() => registrarPrimeiraOcorrencia(`, não só a
 * presença solta da palavra `after` (que também aparece em comentários e no nome de outras
 * funções) — e reprova se algum dia voltar a ser um `await` bloqueante antes do `return`.
 */
const HOJE = 'src/app/admin/hoje/page.tsx'

describe('hoje: registrar o evento do funil não pode voltar a travar a tela', () => {
  const fonte = semComentarios(readFileSync(HOJE, 'utf8'))

  it('a leitura não voltou vazia', () => {
    expect(fonte.length).toBeGreaterThan(500)
  })

  it('registrarPrimeiraOcorrencia roda dentro de after(), não num await solto', () => {
    expect(fonte).toMatch(/after\(\(\)\s*=>\s*registrarPrimeiraOcorrencia\(/)
  })

  it('não existe mais um await bloqueante chamando registrarPrimeiraOcorrencia direto', () => {
    // Casa com `await registrarPrimeiraOcorrencia(` — a forma exata do defeito medido — sem casar
    // com `after(() => registrarPrimeiraOcorrencia(`, que não tem `await` nenhum antes da chamada.
    expect(fonte).not.toMatch(/\bawait\s+registrarPrimeiraOcorrencia\(/)
  })

  it('o detector reconhece o defeito que ele impede', () => {
    const comDefeito = "if (atribuicao.count > 0) {\n  await registrarPrimeiraOcorrencia(db, ctx.tenantId, 'x', {})\n}"
    expect(/after\(\(\)\s*=>\s*registrarPrimeiraOcorrencia\(/.test(comDefeito)).toBe(false)
    expect(/\bawait\s+registrarPrimeiraOcorrencia\(/.test(comDefeito)).toBe(true)
  })
})
