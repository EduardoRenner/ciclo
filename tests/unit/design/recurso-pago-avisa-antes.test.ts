import { readFileSync } from 'node:fs'
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
      /*
       * Recortado no BOTAO, nao no arquivo. A primeira versao casava com `motivoDesabilitado` em
       * qualquer lugar — e o arquivo ja tinha OUTRA ocorrencia, no formulario de entrada. A
       * mutacao que apagava a explicacao do botao passava verde por causa da vizinha.
       */
      const i = fonte.indexOf('disabled={!podeLancar}')
      expect(i, 'nao achei o botao travado pelo plano').toBeGreaterThan(-1)
      const bloco = fonte.slice(i, fonte.indexOf('>', fonte.indexOf('onClick', i)))
      expect(bloco, 'o botao trava sem explicar').toContain('motivoDesabilitado')
    })

    it(`${nome}: oferece o caminho, nao so a recusa`, () => {
      expect(fonte, 'sumiu o BloqueioPlano — a recusa virou beco').toContain('BloqueioPlano')
    })
  }

  /*
   * Campanhas entrou aqui na auditoria de 2026-09-08, e por um motivo que o bloco acima nao
   * pegaria: nao e um BOTAO travado, e a PAGINA inteira. `campanhas/page.tsx` (a lista) checava
   * o plano desde 03/09, mas `campanhas/nova/page.tsx` nao — e ela e alcancavel direto pela URL,
   * por link salvo e pelo card de aniversariantes da Central de Acoes (`crm.ts:661`). Quem
   * chegava por esses caminhos montava a campanha inteira antes da recusa.
   *
   * Por isso a guarda itera as PORTAS DE ENTRADA do fluxo, e nao uma tela so: foi consertar uma
   * e deixar a irma aberta que criou o defeito. E a regra do "consertar a pergunta, nao o caso".
   */
  describe('campanhas: toda porta de entrada do fluxo pago checa o plano antes', () => {
    const PORTAS = [
      join('src', 'app', 'admin', 'campanhas', 'page.tsx'),
      join('src', 'app', 'admin', 'campanhas', 'nova', 'page.tsx'),
    ]

    it.each(PORTAS)('%s consulta podeUsarModulo antes de deixar a pessoa trabalhar', (porta) => {
      const fonte = semComentarios(readFileSync(porta, 'utf8'))
      expect(
        /podeUsarModulo\([^)]*'campaigns'\)/.test(fonte),
        `${porta} nao checa o plano. Quem chegar aqui no Gratis monta a campanha inteira e so ` +
          'descobre que e paga no botao final, com o trabalho jogado fora.',
      ).toBe(true)
    })

    it.each(PORTAS)('%s oferece o caminho, nao so a recusa', (porta) => {
      const fonte = semComentarios(readFileSync(porta, 'utf8'))
      expect(fonte, `${porta} recusa sem mostrar o que fazer`).toContain('BloqueioPlano')
    })

    it('o toast de falha repassa o motivo que a rota devolveu', () => {
      /*
       * A rota responde "Isso faz parte do plano Essencial." e a tela descartava o corpo inteiro,
       * mostrando so "nao consegui". Casa com a LEITURA da mensagem, nao com a palavra `descricao`
       * solta — que aparece em outros toasts do mesmo arquivo por outro motivo.
       */
      const fonte = semComentarios(readFileSync(join('src', 'app', 'admin', 'campanhas', 'nova', 'nova.tsx'), 'utf8'))
      expect(
        /json\?\.error\?\.message/.test(fonte),
        'o toast voltou a jogar fora o motivo da recusa que a rota mandou',
      ).toBe(true)
    })
  })

  it('a rota de escrita continua travada no servidor — o aviso na tela nao substitui a trava', () => {
    /*
     * O aviso e desenho; quem RECUSA e a rota. Se alguem "simplificar" tirando o exigirModulo
     * porque "a tela ja avisa", o recurso pago passa a ser so uma sugestao.
     */
    const rota = semComentarios(readFileSync(join('src', 'app', 'api', 'v1', 'inventory', 'entries', 'route.ts'), 'utf8'))
    expect(rota, 'a rota de entrada de estoque parou de exigir o modulo').toContain("exigirModulo(db, ctx.tenantId, 'stock')")
  })
})
