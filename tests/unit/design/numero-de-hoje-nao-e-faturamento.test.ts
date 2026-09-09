import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { semComentarios } from '../../helpers/fonte'

import { describe, expect, it } from 'vitest'

/**
 * Dois numeros de "hoje", vindos de fontes diferentes, e um deles se chamava faturamento.
 *
 *   Hoje  -> soma `appointments.price_cents` dos concluidos: PRECO DE TABELA. Nao enxerga
 *            desconto dado na comanda, item extra lancado nem gorjeta.
 *   Caixa -> soma `tickets.total_cents` das comandas FECHADAS: o dinheiro de verdade.
 *
 * Os dois estao certos para o que medem. O errado era o rotulo do primeiro dizer "Faturado hoje" —
 * num dia com desconto, ele mostra mais do que a pessoa recebeu, e "faturar" em portugues de
 * negocio e o que entrou.
 */
const HOJE = readFileSync('src/app/admin/hoje/hoje.tsx', 'utf8')
const CAIXA = readFileSync('src/app/admin/caixa/caixa.tsx', 'utf8')
const RESUMO = readFileSync('src/server/services/resumo-hoje.ts', 'utf8')

describe('o numero de "hoje" nao se chama faturamento', () => {
  it('o rotulo do heroi da tela Hoje nao promete faturamento', () => {
    const m = HOJE.match(/const ROTULO_DO_ATENDIDO = '([^']+)'/)
    expect(m, 'a constante do rotulo sumiu — se virou string solta, este teste fica cego').not.toBeNull()
    expect(m![1], 'o rotulo voltou a prometer faturamento sobre preco de tabela').not.toMatch(/faturad/i)
  })

  it('o numero continua vindo do agendamento — se mudar a fonte, o rotulo pode mudar junto', () => {
    // Guarda de direcao: se um dia este numero passar a somar comandas, ele PODE voltar a se
    // chamar faturamento. Enquanto somar preco de tabela, nao pode.
    expect(RESUMO).toContain("a.status === 'done'")
    expect(RESUMO).toContain('price_cents')
  })

  it('o caixa continua sendo quem fala de dinheiro que entrou', () => {
    expect(CAIXA, 'o rotulo honesto do caixa sumiu').toContain('Entrou no dia')
  })

  it('as duas telas nao usam o mesmo rotulo para numeros diferentes', () => {
    const rotuloHoje = HOJE.match(/const ROTULO_DO_ATENDIDO = '([^']+)'/)![1]
    expect(CAIXA, 'as duas telas passaram a chamar coisas diferentes pelo mesmo nome').not.toContain(
      'rotulo="' + rotuloHoje + '"',
    )
  })
})

/**
 * A REGRA VALE FORA DAS TRÊS TELAS, e foi assim que a palavra sobreviveu.
 *
 * O bloco acima confere `hoje.tsx`, `caixa.tsx` e `resumo-hoje.ts` — os três arquivos onde o
 * defeito apareceu em 31/08. Em 2026-09-09, varrendo o resto do projeto atrás das mesmas palavras,
 * achei a mentira viva em `server/assistente/ferramentas.ts`:
 *
 *   > "O que está na agenda de hoje: próxima cliente, **faturado até agora**, …"
 *
 * É a descrição de `resumo_de_hoje`, que chama `resumoDeHoje` — a MESMA função cuja tela foi
 * corrigida para "Atendido hoje", com um comentário dizendo *"'Faturado hoje' era mentira por uma
 * palavra, e ficou escrito aqui para não voltar"*.
 *
 * E dói mais no assistente do que na tela: a descrição é o que o modelo lê para decidir quando
 * chamar a ferramenta E como redigir a resposta. O dono pergunta "quanto faturei hoje?", o modelo
 * casa com a palavra, chama a ferramenta do preço de tabela e devolve a frase com o nome errado —
 * em linguagem natural, que é onde ninguém confere.
 *
 * A varredura passa a ser por diretório. Ancorar nos arquivos onde o defeito nasceu é o que
 * deixou esta passar.
 */

const RAIZES_DO_VOCABULARIO = ['src/app', 'src/components', 'src/core', 'src/lib', 'src/server']

/**
 * `src/lib` está aqui de propósito: a Unidade 7 provou que copy de produto mora lá
 * (`planos-cartoes.ts` é lido pela página de preço E por "Meu plano"). Só duas das dezoito guardas
 * que varrem árvore o incluíam.
 */
function fontesDoProjeto(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name).split(String.fromCharCode(92)).join('/')
    if (entrada.isDirectory()) achados.push(...fontesDoProjeto(caminho))
    else if (/[.]tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

/*
  NÃO existe lista de exceções, e a primeira versão desta guarda tinha uma.

  Eu tinha escrito "o caixa é o único lugar onde 'faturado' é verdade" e isentado duas telas.
  O piso que confere a lista reprovou na hora: `caixa.tsx` **não diz "faturado"**. A palavra da
  casa para dinheiro que entrou é *"Entrou"* — "Entrou no dia", "Entrou no mês", "Entrou" no
  fechamento. Isentei duas telas de dizer uma palavra que elas não dizem.

  Sem exceção a regra fica mais forte e mais simples: **"faturado" não é vocabulário deste
  produto em lugar nenhum.** Se um dia for, entra aqui com o motivo — e com o piso de que o
  arquivo isento realmente diz a palavra.
*/

describe('nenhuma superfície chama preço de tabela de faturamento', () => {
  const TODOS = RAIZES_DO_VOCABULARIO.flatMap(fontesDoProjeto)

  it('a varredura enxerga o projeto — não passa por não ter olhado nada', () => {
    expect(TODOS.length, 'a varredura cegou').toBeGreaterThan(150)
    expect(TODOS, 'a tela de hoje saiu do alcance').toContain('src/app/admin/hoje/hoje.tsx')
    // O positivo conhecido de 2026-09-09: onde a palavra estava viva.
    expect(TODOS, 'o arquivo das ferramentas do assistente saiu do alcance').toContain('src/server/assistente/ferramentas.ts')
  })

  it('nenhum arquivo do projeto diz "faturado"', () => {
    const infratores: string[] = []
    for (const arquivo of TODOS) {
      const src = semComentarios(readFileSync(arquivo, 'utf8'))
      /*
       * "NÃO é faturamento" é a negação, e ela é a copy CERTA — proibi-la seria proibir o conserto.
       * Some antes de procurar, que é o mesmo cuidado que a guarda de gênero faz com a exceção.
       */
      const semNegacao = src.split(/N[ÃA]O é faturamento/i).join(' ')
      if (/faturad/i.test(semNegacao)) infratores.push(arquivo)
    }
    expect(
      infratores,
      '"faturado" não é vocabulário deste produto. O que entrou chama-se "Entrou" (comanda ' +
        'fechada); a soma de `price_cents` é o que foi ATENDIDO, e num dia com desconto os dois ' +
        'números diferem.',
    ).toEqual([])
  })
})

/**
 * A REGRA CERTA NÃO É SOBRE A PALAVRA, É SOBRE O NÚMERO — e a versão anterior desta guarda só
 * funcionava por acidente.
 *
 * Eu tinha escrito "'faturado' não é vocabulário deste produto em lugar nenhum" e o padrão era
 * `/faturad/i`. Ele não casa `faturou`, `faturei` nem `faturamento` — e a regra absoluta só passou
 * porque o padrão era estreito demais para encontrar os casos em que ela estaria ERRADA.
 *
 * Porque a palavra É legítima: `faturamento_do_periodo` lê o fechamento de caixa, e ali faturamento
 * é faturamento mesmo. O que nunca é legítimo é chamar de faturamento os números derivados de
 * `price_cents`:
 *
 *   `revenueTodayCents` — soma do preço de tabela dos atendimentos CONCLUÍDOS ("Atendido hoje");
 *   `forecastCents`     — soma do preço de tabela do que ainda conta como receita ("Previsto").
 *
 * Achados vivos em 2026-09-09, todos no assistente, que é a superfície que fala em frases:
 *
 *   1. a resposta rápida dizia **"Você já faturou R$ X hoje"** com `revenueTodayCents`;
 *   2. a pergunta sugerida no botão era **"Quanto eu já faturei hoje?"**, apontando para ela;
 *   3. a ferramenta expunha o campo **`faturamentoPrevistoCents`** com `forecastCents`.
 *
 * O terceiro é o mais silencioso: nome de campo é o que o modelo lê para redigir a resposta.
 */

/** As duas somas de preço de tabela. Perto delas, a palavra "faturamento" é mentira. */
const NUMEROS_DE_TABELA = ['revenueTodayCents', 'forecastCents']

/** A família inteira, e não só o particípio — foi o particípio sozinho que deixou os três passarem. */
const PALAVRA = /\bfatur(?:ad[oa]s?|ou|ei|amos|ar|amento\w*)\b/i

describe('a palavra "faturamento" não encosta nos números de preço de tabela', () => {
  const TODOS = RAIZES_DO_VOCABULARIO.flatMap(fontesDoProjeto)

  it('o detector conhece a família toda, não só o particípio', () => {
    // Autoteste: a versão anterior (`/faturad/i`) achava só a primeira destas.
    for (const forma of ['faturado', 'faturou', 'faturei', 'faturamento', 'faturamentoPrevistoCents']) {
      expect(PALAVRA.test(forma), `o detector não conhece "${forma}"`).toBe(true)
    }
    // E não acusa palavra de outra família.
    for (const outra of ['fatura de energia', 'featured', 'atendido']) {
      expect(PALAVRA.test(outra), `o detector acusou "${outra}"`).toBe(false)
    }
  })

  it('os números de tabela ainda existem — a guarda não passa por não achar nada', () => {
    const ondeVivem = TODOS.filter((a) => NUMEROS_DE_TABELA.some((n) => readFileSync(a, 'utf8').includes(n)))
    expect(ondeVivem.length, 'nenhum dos números de preço de tabela foi encontrado').toBeGreaterThan(2)
  })

  it('nenhuma linha nomeia um número de tabela como faturamento', () => {
    const infratores: string[] = []
    for (const arquivo of TODOS) {
      const src = semComentarios(readFileSync(arquivo, 'utf8'))
      for (const numero of NUMEROS_DE_TABELA) {
        for (let i = src.indexOf(numero); i !== -1; i = src.indexOf(numero, i + 1)) {
          /*
           * Janela curta dos dois lados: pega `faturamentoPrevistoCents: resumo.forecastCents` e
           * `faturou ${...revenueTodayCents...}`, sem alcançar outra frase do arquivo. É o mesmo
           * cuidado que a guarda de vocabulário toma com o artigo colado.
           */
          const janela = src.slice(Math.max(0, i - 120), i + 60)
          if (PALAVRA.test(janela)) infratores.push(`${arquivo}: …${janela.trim().slice(0, 90)}…`)
        }
      }
    }
    expect(
      infratores,
      'um número derivado de `price_cents` está sendo chamado de faturamento. Ele é o ATENDIDO ' +
        '(ou o PREVISTO); o que entrou de verdade sai do fechamento de caixa e pode ser menor.',
    ).toEqual([])
  })
})
