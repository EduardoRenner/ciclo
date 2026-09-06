/**
 * O que ainda falta para o "Sobrou" ser o número de verdade — e a decisão de quando parar de
 * perguntar.
 *
 * Mora em `core/` e não dentro de `centralDeAcoes` por um motivo já pago nesta base: a primeira
 * guarda do card "perto do prêmio" espelhava a fórmula dentro do próprio teste, provava que a
 * conta é proporcional e não que o PRODUTO a usa — e passou verde com o defeito reintroduzido em
 * `crm.ts`. Regra que decide o que aparece na tela vira função pura, e o teste chama a mesma
 * função que a tela chama.
 */

export type TomDaAcao = 'warn' | 'info' | 'ok'

export type AcaoDeCompletude = {
  chave: 'completude-taxa' | 'completude-material'
  titulo: string
  descricao: string
  href: string
  tom: TomDaAcao
}

export type EntradaDeCompletude = {
  /**
   * `report:read`. Sem isso não sai ação nenhuma: o que elas revelam é dinheiro do negócio
   * (`docs/48` §4.6), e o barbeiro comissionado não pode descobrir pela Central de Ações o que a
   * trava da comanda esconde dele.
   */
  podeVerLucro: boolean
  /**
   * O dono já ABRIU a tela de taxas e salvou — mesmo que tenha salvado tudo zero. Ver
   * `taxaEstaConfigurada`: "respondeu zero" e "nunca respondeu" são estados diferentes, e só o
   * segundo merece pergunta.
   */
  taxaRespondida: boolean
  servicosSemFicha: number
  servicosComProdutoSemCusto: number
}

/**
 * A regra que impede isto de virar alarme de fundo: **a pergunta some quando é respondida,
 * inclusive respondida com zero.** Um salão que só recebe em dinheiro e Pix salva a tela de taxas
 * zerada e nunca mais vê o primeiro card; um que preencheu todas as fichas e registrou as compras
 * nunca mais vê o segundo.
 *
 * Não é zelo de copy: esta base tem o `/api/health` devolvendo 503 por meses sem ninguém olhar, e
 * a lição está escrita no `docs/50` §3.1 — alarme que sempre toca deixa de ser lido. Se o card
 * continuar lá depois de respondido, o ticket falhou mesmo com os testes verdes.
 */
export function acoesDeCompletude(entrada: EntradaDeCompletude): AcaoDeCompletude[] {
  if (!entrada.podeVerLucro) return []

  const acoes: AcaoDeCompletude[] = []

  if (!entrada.taxaRespondida) {
    acoes.push({
      chave: 'completude-taxa',
      titulo: 'Você ainda não disse quanto a maquininha cobra',
      descricao:
        'Sem isso o "Sobrou" de cada atendimento sai maior do que é. Se você só recebe em dinheiro e Pix, salve com zero — a pergunta não volta.',
      href: '/admin/config/taxas',
      tom: 'info',
    })
  }

  /*
   * As duas causas somam num card só porque o destino é o mesmo e a ficha de cada serviço já
   * explica, lá dentro, qual das duas é a dele. Dois cards com o mesmo link seriam ruído com cara
   * de checklist — e o custo de errar aqui é o alarme ignorado, não a informação a menos.
   */
  const incompletos = Math.max(0, entrada.servicosSemFicha) + Math.max(0, entrada.servicosComProdutoSemCusto)
  if (incompletos > 0) {
    acoes.push({
      chave: 'completude-material',
      titulo: `${incompletos} ${incompletos === 1 ? 'serviço ainda não desconta o produto' : 'serviços ainda não descontam o produto'}`,
      descricao:
        'Diga o que cada um gasta e quanto você pagou na última compra. É o que falta para o "Sobrou" ser o número de verdade.',
      href: '/admin/config/servicos',
      tom: 'info',
    })
  }

  return acoes
}

/** A lista do catálogo — o destino de quem tem mais de um serviço para resolver. */
export const CATALOGO_DE_SERVICOS = '/admin/config/servicos'

/**
 * Para onde a faixa da comanda leva quando falta o custo do produto — `docs/50` L-02.
 *
 * Com UM serviço incerto, a ficha dele: a faixa já dizia o que falta, e o que faltava era ela
 * custar um toque em vez de uma caçada no catálogo. Com vários, a lista, porque escolher um dos
 * três esconderia os outros dois — e o dono voltaria achando que resolveu.
 *
 * Zero também devolve a lista, e isso não é caso morto: quem chama só desenha a faixa quando há
 * lacuna, mas uma função que devolvesse `null` obrigaria todo chamador a tratar um estado que a
 * tela não alcança, e é assim que nasce o `null` que ninguém trata.
 */
export function destinoDoMaterial(servicos: readonly string[]): string {
  return servicos.length === 1 ? `${CATALOGO_DE_SERVICOS}/${servicos[0]}/ficha` : CATALOGO_DE_SERVICOS
}
