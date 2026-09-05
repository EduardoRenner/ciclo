import { readFileSync } from 'node:fs'

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
 * O corpo de cada `.catch(`, do parêntese até o `}),` que fecha o argumento.
 *
 * Recortar pelo fim real do elemento, e não por uma janela de N caracteres, é a regra que este
 * projeto pagou para aprender quatro vezes (`docs/21` §3): com fatia por tamanho, o `console.warn`
 * de um `catch` vizinho cai dentro da janela do outro e a asserção passa com o defeito de volta.
 */
function corposDeCatch(fonte: string): string[] {
  const corpos: string[] = []
  let de = fonte.indexOf('.catch(')
  while (de !== -1) {
    const fim = fonte.indexOf('}),', de)
    corpos.push(fonte.slice(de, fim === -1 ? fonte.length : fim))
    de = fonte.indexOf('.catch(', de + 1)
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
