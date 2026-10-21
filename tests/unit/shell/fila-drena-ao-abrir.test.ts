import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

import { ESPERA_MAXIMA_MS, proximaTentativaMs } from '@/core/offline/queue'

/**
 * APR-021 (achado C-45, reproduzido): agendamento guardado sem rede, app fechado, aberto de novo COM
 * rede → 0 POST em 10 s e o item preso na fila. `drenarFilaPendente` só rodava no evento `online`,
 * que não acontece quando a rede já voltou antes de o app abrir.
 */
function corposDeUseEffect(fonte: string): string[] {
  const corpos: string[] = []
  let i = fonte.indexOf('useEffect(')
  while (i !== -1) {
    // Do `(` do useEffect até o `)` que FECHA a chamada — não uma janela de caracteres.
    let profundidade = 0
    let j = i + 'useEffect'.length
    for (; j < fonte.length; j++) {
      if (fonte[j] === '(') profundidade++
      else if (fonte[j] === ')') {
        profundidade--
        if (profundidade === 0) break
      }
    }
    corpos.push(fonte.slice(i, j + 1))
    i = fonte.indexOf('useEffect(', j)
  }
  return corpos
}

const casca = semComentarios(readFileSync('src/components/shell/resolucao-de-fila.tsx', 'utf8'))

describe('a fila offline sai ao abrir o app (APR-021)', () => {
  it('controle positivo: o recorte acha o corpo do efeito inteiro, com parênteses aninhados', () => {
    const corpos = corposDeUseEffect(`useEffect(() => { f(g(1)); void drenarFilaPendente() }, [])\nconst x = drenarFilaPendente`)
    expect(corpos).toHaveLength(1)
    expect(corpos[0]).toContain('void drenarFilaPendente()')
    expect(corpos[0]).not.toContain('const x')
  })

  it('a casca tem efeitos para varrer (não passa vazia)', () => {
    expect(corposDeUseEffect(casca).length).toBeGreaterThan(0)
  })

  it('um efeito de montagem define a sessão, drena, e drena de novo ao voltar para o app', () => {
    const efeito = corposDeUseEffect(casca).find((c) => /definirSessaoDaFila\(/.test(c))
    expect(efeito, 'nenhum efeito define a sessão da fila').toBeDefined()
    // DUAS chamadas: uma ao montar e uma no listener. Casar com "alguma chamada" era cego — a do
    // listener sozinha passava com a de montagem removida (mutação vista passando verde).
    expect(efeito!.match(/drenarFilaPendente\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(efeito).toMatch(/addEventListener\('visibilitychange'/)
    // A sessão é definida ANTES da 1ª drenagem: senão a fila sairia sem saber de quem é (APR-020).
    expect(efeito!.indexOf('definirSessaoDaFila(')).toBeLessThan(efeito!.indexOf('drenarFilaPendente('))
  })

  it('o backoff cresce e para num teto, sem desistir', () => {
    expect(proximaTentativaMs(0)).toBe(2_000)
    expect(proximaTentativaMs(1)).toBeGreaterThan(proximaTentativaMs(0))
    expect(proximaTentativaMs(50)).toBe(ESPERA_MAXIMA_MS)
    expect(ESPERA_MAXIMA_MS).toBeLessThanOrEqual(60_000)
  })
})
