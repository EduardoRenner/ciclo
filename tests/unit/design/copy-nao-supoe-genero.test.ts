import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MODELOS_PADRAO } from '@/server/services/mensagens-prontas'
import { promptDeSistema } from '@/server/services/assistente'

import { semComentarios } from '../../helpers/fonte'

/**
 * O CICLO atende barbearia, unhas, cílios, sobrancelha, depilação e estética. Fora a barbearia,
 * **a maioria de quem paga é mulher** — e a copy tratava todo mundo no masculino.
 *
 * Dois lugares, e o segundo é pior que o primeiro:
 *
 *   1. `/entrar` abria com "Bem-vindo de volta". Erra com a maior parte da base logo na porta.
 *   2. Três modelos de mensagem pronta escreviam **"obrigado" em primeira pessoa** — texto que a
 *      manicure manda para a cliente dela, com o produto conjugando por ela no gênero errado. Aqui
 *      quem passa vergonha não é o CICLO, é a profissional, na frente da cliente dela. É a mesma
 *      régua da armadilha "prometer canal" do `CLAUDE.md`: o custo cai no salão.
 *
 * A guarda cobre as duas superfícies e o prompt do assistente, que é a terceira e escreve sozinho.
 *
 * **O que ela NÃO faz:** proibir "o" e "a" no projeto inteiro. Concordância com COISA está certa
 * ("nenhum serviço cadastrado", "horário marcado") e caçar isso produziria ruído sem defeito. A
 * lista é de construções que se dirigem a UMA PESSOA, que é onde o erro dói.
 */

/** Construções que falam COM a pessoa e supõem que ela é homem. */
const SUPOE_HOMEM: { padrao: RegExp; porque: string }[] = [
  { padrao: /bem-?vindo\b/i, porque: '"bem-vindo" erra com a maioria da base; use "que bom te ver"' },
  { padrao: /\bobrigado\b/i, porque: '"obrigado" na voz de quem usa o produto; use "valeu" ou "que bom"' },
  { padrao: /voc[êe] (est[áa]|ficou|seria) (preparado|pronto|cadastrado|bem-?vindo)\b/i, porque: 'particípio no masculino falando com a pessoa' },
  { padrao: /\bcaro (usu[áa]rio|cliente|profissional)\b/i, porque: 'vocativo no masculino' },
  /*
    Entrou depois, e por medição: a lista original não pegou "Qualquer um" no seletor de
    profissional do agendamento público. Num salão de unhas ou cílios a equipe inteira costuma ser
    de mulheres, e o produto oferecia à cliente uma opção no masculino para escolher entre elas —
    na tela de maior volume que existe. Achado abrindo a página, não lendo o código.
  */
  /*
    A lista de complementos é explícita, e não `d[eo]s?`, porque a primeira versão era esse padrão
    e ele NÃO bloqueava "deles": `d`+`[eo]`+`s?` casa "de" e aí o `\b` falha diante do "l". A
    exceção passou a acusar copy legítima, que é o custo simétrico da guarda cega — detector que
    reprova o que está certo manda alguém "consertar" código bom.
  */
  {
    padrao: /\bqualquer um\b(?!\s+(dos|das|deles|delas|de|do|da)\b)/i,
    porque: '"qualquer um" escolhendo entre pessoas; use "tanto faz"',
  },
  { padrao: /\btodos (est[ãa]o|ficaram) (prontos|preparados)\b/i, porque: 'plural no masculino falando de pessoas' },
]

const RAIZES = ['src/app', 'src/components']

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/[.]tsx$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

const TELAS = RAIZES.flatMap(arquivos).map((f) => f.split(String.fromCharCode(92)).join('/'))

describe('o leitor deste teste', () => {
  it('enxerga as telas — não passa por não ter olhado nada', () => {
    expect(TELAS.length).toBeGreaterThan(80)
  })

  it('os padrões pegam as construções que motivaram a guarda', () => {
    // Guarda contra o próprio detector: se um regex parar de casar, tudo passa vazio.
    expect(SUPOE_HOMEM[0]!.padrao.test('Bem-vindo de volta')).toBe(true)
    expect(SUPOE_HOMEM[1]!.padrao.test('{{nome}}, obrigado por confiar no meu trabalho!')).toBe(true)
    expect(SUPOE_HOMEM[2]!.padrao.test('você está preparado para começar')).toBe(true)
    expect(SUPOE_HOMEM[4]!.padrao.test('Qualquer um'), '"Qualquer um" do seletor de profissional').toBe(true)
  })

  it('não acusa concordância com coisa, que está certa', () => {
    // O falso positivo que tornaria esta guarda ruído: "cadastrado" concordando com "serviço".
    for (const certo of ['Nenhum serviço cadastrado', 'horário marcado', 'orçamento aprovado', 'Nada foi bloqueado']) {
      expect(SUPOE_HOMEM.some((r) => r.padrao.test(certo)), `acusou "${certo}", que está certo`).toBe(false)
    }
  })

  it('não acusa "qualquer um DELES", que é pronome de coisa e está certo', () => {
    /*
     * A exceção que o padrão precisa fazer, e ela é real: "um erro em qualquer um deles", "se
     * perguntarem sobre qualquer um deles" aparecem em comentário e em copy legítima do produto.
     * O que erra é "qualquer um" escolhendo entre PESSOAS, sem complemento.
     */
    for (const certo of ['um erro em qualquer um deles', 'qualquer um dos dois já alerta', 'sobre qualquer um deles']) {
      expect(SUPOE_HOMEM.some((r) => r.padrao.test(certo)), `acusou "${certo}", que está certo`).toBe(false)
    }
  })
})

describe('a copy não supõe que quem usa o produto é homem', () => {
  it('nenhuma tela fala com a pessoa no masculino', () => {
    const achados: string[] = []
    for (const tela of TELAS) {
      const fonte = semComentarios(readFileSync(tela, 'utf8'))
      for (const { padrao, porque } of SUPOE_HOMEM) {
        if (padrao.test(fonte)) achados.push(`${tela}: ${porque}`)
      }
    }
    expect(achados, 'a maior parte de quem paga por este produto é mulher').toEqual([])
  })

  it('nenhum modelo de mensagem pronta conjuga no masculino pela profissional', () => {
    /*
     * O caso mais caro: são as mensagens que ela manda para a cliente DELA. Três estavam com
     * "obrigado" em primeira pessoa — o produto falando por ela, no gênero errado, na frente de
     * quem paga a ela.
     */
    const errados = MODELOS_PADRAO.filter((m) =>
      SUPOE_HOMEM.some((r) => r.padrao.test(`${m.title} ${m.body}`)),
    ).map((m) => m.slug)
    expect(errados, 'o produto está conjugando no masculino na voz da profissional').toEqual([])
  })

  it('o prompt do assistente manda não supor gênero', () => {
    // A terceira superfície, e a única que escreve texto novo: sem a instrução, o modelo produz
    // "seja bem-vindo" e "você está preparado" por conta própria.
    const prompt = promptDeSistema('2026-09-03')
    expect(/sem supor o g[êe]nero|neutr/i.test(prompt), 'o prompt não diz nada sobre gênero').toBe(true)
  })
})
