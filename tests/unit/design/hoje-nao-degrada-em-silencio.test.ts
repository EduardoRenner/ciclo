import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A tela "Hoje" é a mais aberta do produto, e as duas consultas de CRM que a enriquecem falham
 * para dentro de propósito: `centralDeAcoes` e `receitaAtribuidaAoCiclo` têm `.catch()` para que
 * um agregado quebrado nunca derrube a tela inteira. Isso está certo e continua.
 *
 * O que estava errado é o silêncio. O `CLAUDE.md` põe a regra na tabela de armadilhas com estas
 * palavras: *"o `catch` descarta alguma coisa? Então tem que contar e avisar"*.
 *
 * **Por que aqui dói mais que numa degradação comum**, e é a razão desta guarda existir só para
 * esta tela: `deveMostrarHeroiDoMotor` (em `hoje.tsx`) só mostra o herói do Motor de Ciclo quando
 * `atribuicaoCount > 0`. O `catch` da atribuição devolve `count: 0` — o mesmo valor que "não
 * houve atribuição nenhuma". Então uma falha transitória não degrada um canto da tela: ela reverte
 * exatamente a melhoria do F1 (`docs/25-ESTRATEGIA-E-EXECUCAO.md`) e faz a tela voltar a abrir com
 * "R$ 0,00", que o §2.2 do mesmo documento identificou como o pior primeiro contato possível com o
 * produto.
 *
 * Sem log, o sintoma seria uma tela levemente mais pobre, para sempre, sem ninguém reportar. É a
 * forma de falha silenciosa que o `docs/21-AUDITORIA-FALHA-SILENCIOSA.md` persegue.
 */

const HOJE = 'src/app/admin/hoje/page.tsx'

/**
 * O corpo de cada `.catch(`, do parêntese de abertura até o que o fecha — contando profundidade,
 * não procurando um delimitador de texto.
 *
 * Recortar pelo fim real do elemento, e não por uma janela ou por um terminador escolhido a olho,
 * é a regra que este projeto pagou para aprender quatro vezes (`docs/21` §3). **A primeira versão
 * desta função errou exatamente assim, e a mutação flagrou:** ela cortava no próximo `}),`, que só
 * existe quando o `catch` recebe um bloco. Para a forma curta — `.catch(() => ({ ... }))`, que é
 * justamente a do defeito — não havia `}),` nenhum, então o recorte ia até muito adiante no
 * arquivo, engolia um `console.warn` de outro trecho, e a guarda passava verde com o `catch` mudo
 * de volta. Contar parêntese não tem essa forma de cegueira.
 */
function corposDeCatch(fonte: string): string[] {
  const corpos: string[] = []
  for (let de = fonte.indexOf('.catch('); de !== -1; de = fonte.indexOf('.catch(', de + 1)) {
    const abre = fonte.indexOf('(', de + 6)
    let profundidade = 0
    let fim = fonte.length
    for (let i = abre; i < fonte.length; i++) {
      if (fonte[i] === '(') profundidade++
      else if (fonte[i] === ')') {
        profundidade--
        if (profundidade === 0) {
          fim = i + 1
          break
        }
      }
    }
    corpos.push(fonte.slice(abre, fim))
  }
  return corpos
}

describe('a tela mais aberta do app degrada, mas não em silêncio', () => {
  const fonte = semComentarios(readFileSync(HOJE, 'utf8'))
  const corpos = corposDeCatch(fonte)

  it('a leitura enxerga os catch — senão a guarda passa vazia', () => {
    /*
     * Guarda contra o próprio detector: se `.catch(` sumir do arquivo (renomeado, refatorado para
     * try/catch), o `it.each` abaixo roda zero vezes e o teste inteiro fica verde sem provar nada.
     * As duas consultas de CRM são as que precisam falhar para dentro; se um dia forem três, este
     * número sobe junto e obriga a olhar a nova.
     */
    expect(corpos.length, `${HOJE} não tem mais nenhum .catch() — esta guarda precisa ser revista`).toBeGreaterThanOrEqual(2)
  })

  it.each([0, 1])('o catch nº %i registra a falha antes de devolver o padrão', (i) => {
    expect(
      /console\.warn\(/.test(corpos[i] ?? ''),
      'um `.catch()` desta tela devolve valor padrão sem registrar nada. O `count: 0` da atribuição ' +
        'é indistinguível de "não houve atribuição", e sem log a tela volta a abrir com R$ 0,00 ' +
        'para sempre sem ninguém saber.',
    ).toBe(true)
  })

  it('cada catch tem um evento com nome próprio — dois logs iguais não dizem qual quebrou', () => {
    /*
     * `event:` nomeado, e nomes DIFERENTES entre si. Um `console.warn` genérico nos dois lados
     * cumpriria a asserção acima e continuaria inútil no dia da falha: o log diria que algo
     * quebrou, não o quê.
     */
    const eventos = [...fonte.matchAll(/event:\s*'([^']+)'/g)].map((m) => m[1])
    expect(eventos.length, 'nenhum evento nomeado nos catch desta tela').toBeGreaterThanOrEqual(2)
    expect(new Set(eventos).size, `os eventos se repetem: ${eventos.join(', ')}`).toBe(eventos.length)
  })
})

/**
 * O irmão do bloco acima, e ele existe porque o conserto de cima nasceu incompleto.
 *
 * `receitaAtribuidaAoCiclo` é o número que responde *"quanto o Motor de Ciclo trouxe"* — o ativo
 * comercial que o `docs/25` §2.1 chama de resposta a ROI, e o `docs/43` usa como eixo 1 do
 * posicionamento. Quando ele foi protegido em `admin/hoje/page.tsx`, a MESMA chamada com o MESMO
 * `catch` mudo continuou em `admin/campanhas/page.tsx` — onde dói mais, porque lá o valor vai
 * direto para um `StatTile` que afirma "Voltaram este mês · R$ 0,00 · de 0 mensagens enviadas".
 * Falha virando medição, na tela cujo trabalho é reportar resultado.
 *
 * É o padrão que a super auditoria nomeou como o achado mais reusável desta base: **um conserto
 * certo, aplicado num lugar só.** Por isso esta guarda não cita arquivo: ela DESCOBRE quem chama e
 * cobra de todos. Uma terceira tela que passe a mostrar o número entra na lista sozinha.
 */
const NUMEROS_DE_ROI = ['receitaAtribuidaAoCiclo', 'receitaPorCampanha']

function telasDoApp(dir: string): string[] {
  const achadas: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achadas.push(...telasDoApp(caminho))
    else if (/\.tsx?$/.test(entrada.name)) achadas.push(caminho)
  }
  return achadas
}

const CONSUMIDORES = telasDoApp('src/app').filter((arquivo) => {
  const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
  return NUMEROS_DE_ROI.some((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(fonte))
})

describe('quem mostra "quanto o Motor trouxe" não transforma falha em zero calado', () => {
  it('a busca encontra os consumidores — senão o it.each roda vazio', () => {
    /*
     * O piso é 2 porque hoje são exatamente duas telas, e não um número folgado: se cair para 1,
     * alguém removeu um consumidor e esta guarda precisa ser relida junto. Subir é normal —
     * uma tela nova entra e passa a ser cobrada.
     */
    expect(CONSUMIDORES.length, 'nenhuma tela chama os números de ROI — a guarda passaria vazia').toBeGreaterThanOrEqual(2)
  })

  it.each(CONSUMIDORES)('%s registra a falha em vez de devolver zero calado', (arquivo) => {
    const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
    for (const corpo of corposDeCatch(fonte)) {
      /*
       * Só cobra o `catch` que DEVOLVE um valor. `catch` que re-lança (o padrão `NOT_FOUND` das
       * páginas públicas) não engole nada e não precisa registrar — cobrar dele seria ruído, e
       * ruído treina a ignorar alarme.
       */
      const devolveValor = /=>\s*\(?\s*[{[]/.test(corpo) || /return\s*[{[]/.test(corpo) || /=>\s*new Map/.test(corpo)
      const relanca = /throw\s/.test(corpo)
      if (!devolveValor || relanca) continue

      expect(
        /console\.warn\(/.test(corpo),
        `${arquivo} tem um \`.catch()\` que devolve valor padrão sem registrar. O zero fica ` +
          `indistinguível de "não houve retorno nenhum" — e este é o número que sustenta o preço.`,
      ).toBe(true)
    }
  })
})
