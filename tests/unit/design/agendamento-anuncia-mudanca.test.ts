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
const RECUPERAR = 'src/app/admin/recuperar/recuperar.tsx'
const CLIENTES = 'src/app/admin/clientes/lista.tsx'

/**
 * Sem comentário. O bloco que explica esta guarda cita `aria-live` várias vezes, e uma asserção
 * que casasse com ele passaria com o elemento apagado — o erro que já apareceu três vezes nesta
 * família de testes (`docs/21-AUDITORIA-FALHA-SILENCIOSA.md` §3).
 */
function fonte(arquivo: string = AGENDAR): string {
  return readFileSync(arquivo, 'utf8')
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

/**
 * O mesmo defeito estava na tela do Motor de Ciclo, e ali dói mais: é o diferencial que sustenta
 * o preço do produto. Trocar o filtro recarrega a lista E os dois números do topo, sem trocar de
 * rota — e nada avisava.
 *
 * ⚠️ Diferença de rigor que precisa ficar dita: o caso do agendamento foi verificado no navegador
 * ponta a ponta; este NÃO foi, porque `/admin` exige sessão e daqui não dá para autenticar sem
 * credencial de produção. O mecanismo é o mesmo já provado na página pública; o que esta guarda
 * cobre é a estrutura, não o comportamento renderizado.
 */
describe('a lista do Motor de Ciclo anuncia o que mudou ao trocar o filtro', () => {
  it('tem região viva de verdade, fora de comentário', () => {
    expect(/aria-live="polite"/.test(fonte(RECUPERAR)), 'não há região viva na tela de recuperar').toBe(true)
  })

  it('a região vem DEPOIS do filtro e ANTES da lista — existe antes de o conteúdo trocar', () => {
    const src = fonte(RECUPERAR)
    const filtro = src.indexOf('</FilterRow>')
    const regiao = src.indexOf('aria-live="polite"')
    expect(regiao, 'não achei a região viva').toBeGreaterThan(-1)
    expect(regiao, 'a região precisa vir depois do filtro que dispara a troca').toBeGreaterThan(filtro)
  })

  it('o anúncio sai do mesmo `lista` que desenha os números do topo', () => {
    /*
     * Os StatTiles mostram `lista.count` e `lista.totalValueCents`. Se o anúncio tivesse fonte
     * própria, a tela e o leitor de tela poderiam divergir — e número lido diferente do número
     * mostrado é pior que silêncio, porque é mentira com cara de recurso.
     */
    /*
     * O bloco vai da região até o `</p>` DELA, não um pedaço de N caracteres a partir dali. Com
     * fatia por tamanho, o `{carregando}` do esqueleto de carregamento logo abaixo entrava na
     * janela e a asserção passava com o anúncio já quebrado — quarta vez, nesta auditoria, que uma
     * guarda casou com algo incidental vizinho (docs/21 §3). A regra que saiu de lá vale também
     * para o RECORTE, não só para o padrão: delimitar pelo fim real do elemento.
     */
    const src = fonte(RECUPERAR)
    const inicio = src.indexOf('aria-live="polite"')
    const bloco = src.slice(inicio, src.indexOf('</p>', inicio))
    expect(/lista\.count/.test(bloco), 'o anúncio precisa dizer a quantidade que os StatTiles mostram').toBe(true)
    expect(/lista\.totalValueCents/.test(bloco), 'o anúncio precisa dizer o valor que os StatTiles mostram').toBe(true)
    expect(/carregando/.test(bloco), 'o anúncio precisa cobrir o estado de carregando').toBe(true)
  })
})

/**
 * A busca de clientes é o caso mais clássico de todos: a pessoa digita, a lista inteira troca, e
 * quem usa leitor de tela não sabe se achou trinta ou nenhum.
 *
 * E tinha um segundo defeito, da família do `docs/21` §0: `.then().finally()` **sem `.catch()`**.
 * A busca que falhasse deixava a lista ANTERIOR na tela, sem sinal nenhum — a pessoa digitava um
 * nome, via os resultados de antes e concluía que aquele era o resultado. Lista errada com cara de
 * certa é pior que lista vazia.
 */
describe('a busca de clientes anuncia o resultado e não engole a falha', () => {
  it('tem região viva, fora de comentário', () => {
    expect(/aria-live="polite"/.test(fonte(CLIENTES))).toBe(true)
  })

  it('o anúncio diz a quantidade que a lista mostra', () => {
    const src = fonte(CLIENTES)
    const i = src.indexOf('aria-live="polite"')
    const bloco = src.slice(i, src.indexOf('</p>', i))
    expect(/clientes\.length/.test(bloco), 'o anúncio precisa dizer quantos a lista tem').toBe(true)
    expect(/carregando/.test(bloco), 'o anúncio precisa cobrir o estado de buscando').toBe(true)
  })

  it('toda busca trata a falha — nenhuma deixa a lista velha sem aviso', () => {
    /*
     * Conta `.catch(` contra `/api/v1/clients` : são duas buscas (termo e segmento) e as duas
     * precisam tratar. Contar em vez de procurar uma ocorrência é o que impede consertar metade.
     */
    const src = fonte(CLIENTES)
    const buscas = (src.match(/fetch\(`\/api\/v1\/clients/g) ?? []).length
    const tratadas = (src.match(/\.catch\(/g) ?? []).length
    expect(buscas, 'não achei as buscas').toBeGreaterThan(0)
    expect(
      tratadas,
      `${buscas} buscas e só ${tratadas} com catch — a que falhar deixa a lista anterior na tela como se fosse o resultado`,
    ).toBeGreaterThanOrEqual(buscas)
  })
})
