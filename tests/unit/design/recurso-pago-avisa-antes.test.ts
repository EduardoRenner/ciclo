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

  /*
   * 2026-09-19: `docs/23` §7 (26/08) já tinha achado e consertado a MESMA classe em Orçamentos,
   * Equipe, Fidelidade, Clube e Comanda — só que esta guarda nunca foi estendida pra proteger
   * essas correções. Achado generalizando o achado do wordmark cego (mesma sessão): guarda com
   * lista curada e nome "toda porta de entrada" convida à mesma pergunta — a lista bate com o
   * universo real de `grep -rn "podeUsarModulo(" src/`?
   *
   * Cada arquivo abaixo foi lido à mão e confirmado correto ANTES de escrever o teste — não é
   * suposição de que "deve estar certo porque outros estão".
   */
  describe('página inteira avisa antes do módulo pago, não só o botão final', () => {
    /** As duas com UM só módulo — checar e mostrar o aviso no mesmo arquivo, sem ambiguidade. */
    const PAGINAS_DE_UM_MODULO = [
      { arquivo: join('src', 'app', 'admin', 'orcamentos', 'page.tsx'), modulo: 'quotes' },
      { arquivo: join('src', 'app', 'admin', 'config', 'profissionais', '[id]', 'page.tsx'), modulo: 'team' },
    ]

    it.each(PAGINAS_DE_UM_MODULO)('$arquivo ($modulo) checa o módulo e mostra BloqueioPlano', ({ arquivo, modulo }) => {
      const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
      expect(fonte, `${arquivo} parou de checar o módulo '${modulo}'`).toMatch(new RegExp(`podeUsarModulo\\([^)]*'${modulo}'\\)`))
      expect(fonte, `${arquivo}: sumiu o BloqueioPlano — a recusa virou beco`).toContain('BloqueioPlano')
    })

    /**
     * `config/planos/page.tsx` checa DOIS módulos (loyalty e club) no MESMO arquivo, cada um com
     * seu próprio `<BloqueioPlano>`. Tentar delimitar "a região de cada módulo" pela distância até
     * a PRÓXIMA chamada de `podeUsarModulo(` não funciona aqui: as duas chamadas ficam juntas no
     * topo da função (as duas variáveis são calculadas antes de qualquer JSX), então a "região do
     * loyalty" fatiada dessa forma pega só a linha da variável seguinte, nunca chega no JSX de
     * baixo onde o `BloqueioPlano` de verdade mora — reprovava mesmo com o código certo (visto
     * reprovar ao escrever esta guarda, antes deste comentário existir).
     *
     * Por contagem em vez de posição: se QUALQUER um dos dois `<BloqueioPlano>` for apagado, a
     * contagem cai de 2 para 1 e a guarda reprova — não diz qual sumiu, mas não deixa passar.
     */
    it('config/planos/page.tsx checa loyalty E club, com dois BloqueioPlano (um por módulo)', () => {
      const arquivo = join('src', 'app', 'admin', 'config', 'planos', 'page.tsx')
      const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
      expect(fonte, `${arquivo} parou de checar o módulo 'loyalty'`).toMatch(/podeUsarModulo\([^)]*'loyalty'\)/)
      expect(fonte, `${arquivo} parou de checar o módulo 'club'`).toMatch(/podeUsarModulo\([^)]*'club'\)/)
      const ocorrencias = fonte.match(/<BloqueioPlano/g) ?? []
      expect(
        ocorrencias.length,
        `${arquivo}: esperava 2 <BloqueioPlano> (um pra loyalty, um pra club), achei ${ocorrencias.length} — ` +
          'um dos dois avisos sumiu.',
      ).toBe(2)
    })
  })

  /*
   * Comanda não tem `BloqueioPlano` de propósito (ver comentário de `comanda/[id]/page.tsx`: "a
   * comanda é a tela que mostra o que o Essencial faz", banner sumiria com isso) — só o botão
   * travado com `motivoDesabilitado`, mesmo padrão do Estoque, mas o CÁLCULO do módulo está em
   * `page.tsx` (Server Component) e a RENDERIZAÇÃO em `comanda.tsx` (Client Component), arquivos
   * diferentes — por isso não cabe no laço de `TELAS_COM_ESCRITA_DE_MODULO` acima, que assume os
   * dois no mesmo arquivo.
   */
  describe('comanda: item trava sem o módulo register, com motivo', () => {
    const CALCULO = join('src', 'app', 'admin', 'comanda', '[id]', 'page.tsx')
    const RENDER = join('src', 'app', 'admin', 'comanda', '[id]', 'comanda.tsx')

    it(`${CALCULO} ainda calcula a partir do módulo register`, () => {
      const fonte = semComentarios(readFileSync(CALCULO, 'utf8'))
      expect(fonte, `${CALCULO} parou de checar o módulo register`).toMatch(/podeUsarModulo\([^)]*'register'\)/)
    })

    it(`${RENDER}: botão de Adicionar trava e diz por quê`, () => {
      const fonte = semComentarios(readFileSync(RENDER, 'utf8'))
      const i = fonte.indexOf('disabled={!podeLancarItem}')
      expect(i, `${RENDER}: não achei o botão travado por podeLancarItem`).toBeGreaterThan(-1)
      const bloco = fonte.slice(i, fonte.indexOf('>', fonte.indexOf('onClick', i)))
      expect(bloco, `${RENDER}: o botão trava sem explicar o motivo`).toContain('motivoDesabilitado')
    })
  })
})
