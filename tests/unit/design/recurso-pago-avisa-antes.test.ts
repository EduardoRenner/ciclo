import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Tela cujo BOTAO depende de modulo de plano precisa dizer isso ANTES do toque.
 *
 * Medido em 31/08 no tenant de teste (plano Essencial, sem o modulo `stock`): `/admin/estoque`
 * abria inteira, com um botao "Entrada" habilitado em cada produto. O formulario abria, a pessoa
 * preenchia quantidade e custo, e so entao `exigirModulo(..., 'stock')` recusava na rota. Trabalho
 * jogado fora e a pior forma de descobrir que o recurso e pago.
 *
 * Nao e falha de seguranca — a ESCRITA esta travada no servidor, que e a regra da casa ("o modulo
 * vale no SERVIDOR, e so na ESCRITA"). E falha de aviso, e a regra 5.2 e explicita: bloqueio mostra
 * o motivo e o caminho.
 *
 * A tela CONTINUA visivel sem o modulo, de proposito: sumir com ela esconderia o que da para
 * comprar. O que muda e o botao travado com explicacao e o `BloqueioPlano` com o dado dela.
 */
const TELAS_COM_ESCRITA_DE_MODULO: Record<string, { arquivo: string; modulo: string }> = {
  estoque: { arquivo: join('src', 'app', 'admin', 'estoque', 'lista.tsx'), modulo: 'stock' },
}

describe('tela de recurso pago avisa antes do toque', () => {
  for (const [nome, { arquivo }] of Object.entries(TELAS_COM_ESCRITA_DE_MODULO)) {
    const fonte = semComentarios(readFileSync(arquivo, 'utf8'))

    it(`${nome}: o botao de escrita trava quando o plano nao libera`, () => {
      expect(fonte, 'o botao voltou a ficar habilitado sem o modulo').toContain('disabled={!podeLancar}')
    })

    it(`${nome}: e diz por que, em vez de so ficar cinza`, () => {
      // `motivoDesabilitado` vira `title` e `sr-only` — no leitor de tela, sem ela, sai
      // "Entrada, indisponivel" e ponto.
      expect(fonte, 'o botao trava sem explicar').toContain('motivoDesabilitado')
    })

    it(`${nome}: oferece o caminho, nao so a recusa`, () => {
      expect(fonte, 'sumiu o BloqueioPlano — a recusa virou beco').toContain('BloqueioPlano')
    })
  }

  it('a rota de escrita continua travada no servidor — o aviso na tela nao substitui a trava', () => {
    /*
     * O aviso e desenho; quem RECUSA e a rota. Se alguem "simplificar" tirando o exigirModulo
     * porque "a tela ja avisa", o recurso pago passa a ser so uma sugestao.
     */
    const rota = semComentarios(readFileSync(join('src', 'app', 'api', 'v1', 'inventory', 'entries', 'route.ts'), 'utf8'))
    expect(rota, 'a rota de entrada de estoque parou de exigir o modulo').toContain("exigirModulo(db, ctx.tenantId, 'stock')")
  })
})
