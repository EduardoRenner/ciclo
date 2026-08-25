import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * A página de agendamento muda inteira sem trocar de rota: escolher o dia carrega os horários,
 * escolher o horário monta o resumo. Medido no navegador em 2026-08-25, antes desta guarda: clicar
 * num dia trazia **dez** botões de horário para a tela, e `[aria-live]`, `[role=status]` e
 * `[role=alert]` continuavam em **zero** — com o foco parado no `body`.
 *
 * Para quem usa leitor de tela, dez opções novas apareciam e nada avisava. É a WCAG 4.1.3
 * (Status Messages), nível AA, e cai justamente na página que atende o **cliente do salão**.
 *
 * O que este teste guarda não é a existência do atributo — é a parte que faz ele funcionar.
 */

const AGENDAR = 'src/app/(public)/[slug]/agendar/agendar.tsx'

/**
 * Sem comentário. O bloco que explica esta guarda cita `aria-live` várias vezes, e uma asserção
 * que casasse com ele passaria com o elemento apagado — o erro que já apareceu três vezes nesta
 * família de testes (`docs/21-AUDITORIA-FALHA-SILENCIOSA.md` §3).
 */
function fonte(): string {
  return readFileSync(AGENDAR, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

describe('o agendamento anuncia o que mudou sem trocar de rota', () => {
  it('tem uma região viva de verdade, fora de comentário', () => {
    expect(/aria-live="polite"/.test(fonte()), 'não há região viva na página').toBe(true)
  })

  it('a região vive SEMPRE no DOM, não nasce junto com o conteúdo', () => {
    /*
     * O erro clássico desta correção: renderizar a região dentro do mesmo condicional que traz o
     * conteúdo. Leitor de tela precisa estar observando o nó ANTES do texto mudar — região que
     * aparece junto costuma não ser anunciada, e aí o atributo está lá, o teste passa, e a
     * pessoa continua sem saber de nada. Falso verde, de novo.
     *
     * A prova estrutural possível numa varredura: a região aparece ANTES do condicional `{slots ?`
     * que desenha os horários. Estando antes, ela não está dentro dele.
     */
    const src = fonte()
    const regiao = src.indexOf('aria-live="polite"')
    const condicional = src.indexOf('{slots ?')

    expect(regiao, 'não achei a região viva').toBeGreaterThan(-1)
    expect(condicional, 'não achei o condicional que desenha os horários').toBeGreaterThan(-1)
    expect(
      regiao,
      'a região viva está DENTRO do condicional dos horários — ela precisa existir antes, ou o leitor de tela não observa a mudança',
    ).toBeLessThan(condicional)
  })

  it('o texto anunciado sai do mesmo estado que desenha a tela', () => {
    /*
     * Se o anúncio tivesse estado próprio, os dois divergiriam no primeiro bug — a tela mostrando
     * nove horários e o leitor de tela dizendo outra coisa é pior que silêncio, porque é mentira.
     */
    const src = fonte()
    const bloco = src.slice(src.indexOf('aria-live="polite"'), src.indexOf('{slots ?'))
    expect(/slots === null/.test(bloco), 'o anúncio precisa cobrir o estado de carregando').toBe(true)
    expect(/slots\.length === 0/.test(bloco), 'o anúncio precisa cobrir o dia sem horário').toBe(true)
    expect(/slotsUnicos|slots\.length/.test(bloco), 'o anúncio precisa dizer a quantidade que a tela mostra').toBe(true)
  })

  it('não atrapalha a tela de quem enxerga', () => {
    const src = fonte()
    const bloco = src.slice(src.indexOf('aria-live="polite"'), src.indexOf('{slots ?'))
    expect(/sr-only/.test(bloco), 'a região precisa ser sr-only — ela é para o leitor de tela, não para a tela').toBe(true)
  })
})
