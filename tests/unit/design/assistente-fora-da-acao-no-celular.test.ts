import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * APR-101 (docs/98 I-01): no celular, o botão flutuante do assistente cobria a ação da tela
 * ("Mensagem" da ficha ~50% tocável, o valor de "Comandas" do Caixa). Ele passou a existir só no
 * computador; no celular quem abre o mesmo painel é "Perguntar", no topo.
 *
 * Medido no navegador (C:/temp/ciclo-medicao/apr101-assistente.mjs): a 360 e 390 px, 0 botões
 * flutuantes em 6 telas e "Mensagem" 100% tocável; a 1280 px o flutuante continua.
 * Esta guarda trava as duas pontas no código: o botão flutuante mora DENTRO do ramo `ehDesktop`, e o
 * topo dispara o evento que o assistente escuta.
 */
const ASSISTENTE = semComentarios(readFileSync('src/components/shell/assistente-flutuante.tsx', 'utf8'))
const TOPO = semComentarios(readFileSync('src/components/shell/topbar.tsx', 'utf8'))

/** O trecho do ramo de computador: de `{ehDesktop ? (` até o primeiro `) : null}` depois dele. */
function ramoDoComputador(fonte: string): string | null {
  const inicio = fonte.indexOf('{ehDesktop ? (')
  if (inicio < 0) return null
  const fim = fonte.indexOf(') : null}', inicio)
  return fim < 0 ? null : fonte.slice(inicio, fim)
}

describe('o assistente não fica por cima da ação no celular (APR-101)', () => {
  it('o botão flutuante só é desenhado no ramo do computador', () => {
    const ramo = ramoDoComputador(ASSISTENTE)
    expect(ramo, 'não achei o ramo `{ehDesktop ? (` do botão flutuante').not.toBeNull()
    expect(ramo).toMatch(/aria-label="Abrir assistente/)
    // E não sobrou um segundo botão flutuante fora dele.
    expect(ASSISTENTE.split('aria-label="Abrir assistente').length - 1).toBe(1)
  })

  it('o topo abre o assistente pelo evento que ele escuta, e só no celular', () => {
    expect(TOPO).toMatch(/window\.dispatchEvent\(new Event\(EVENTO_ABRIR_ASSISTENTE\)\)/)
    expect(ASSISTENTE).toMatch(/window\.addEventListener\(EVENTO_ABRIR_ASSISTENTE,/)
    expect(TOPO).toMatch(/Perguntar/)
    expect(TOPO).toMatch(/lg:hidden/)
  })

  it('controle: o detector acusa o botão flutuante fora do ramo do computador', () => {
    const defeito = '<>\n<button aria-label="Abrir assistente (arraste)" className="fixed" />\n{ehDesktop ? (<div />) : null}</>'
    const ramo = ramoDoComputador(defeito)
    expect(ramo === null || !/aria-label="Abrir assistente/.test(ramo)).toBe(true)
  })
})
