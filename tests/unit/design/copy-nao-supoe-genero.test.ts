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
  /*
    Entrou em 2026-09-03 porque EU quebrei a decisão da casa nesta rodada: reescrevi a FAQ da home
    de "quem trabalha por conta" para "quem atende sozinho", e a tabela do `docs/20` §C.4 diz, com
    estas palavras, que *"quem atende sozinho" não resolve → "quem trabalha por conta"*.

    O padrão pega as DUAS formas de propósito. Escolher o feminino não é melhor que escolher o
    masculino — é o mesmo erro virado para o outro lado, e o §C.4 é explícito: "evita escolher um
    gênero em vez de trocar de gênero". A saída é reescrever sem gênero, não alternar.

    **A primeira versão deste padrão era `(atende|trabalha|cuida|faz)\s+sozinh[oa]` e reprovou copy
    CORRETA:** "O que o CICLO faz sozinho por você" (tela de automações). Ali "sozinho" concorda com
    o CICLO, que é coisa — não há gênero de pessoa nenhum na frase. Guarda que acusa o certo custa
    o mesmo que guarda que absolve o errado: manda alguém "consertar" código bom.

    O padrão exige um marcador de PESSOA antes ("quem", "você"), que é o que distingue "quem atende
    sozinho" (erro) de "o CICLO faz sozinho" (certo). Os dois casos reais estão no autoteste.

    **E a segunda versão dele era CEGA, pela armadilha de regex em português desta casa.** Estava
    escrita `\b(quem|voc[êe])\b` — e o `\b` depois da alternativa acentuada NUNCA casa: em JS sem a
    flag `u`, `\w` é `[A-Za-z0-9_]`, então `ê` é não-palavra, e entre "ê" e o espaço não existe
    fronteira. A mutação passou verde com "Você atende sozinho" de volta no cartão do Grátis, e só
    apareceu porque a mutação é obrigatória.

    É a MESMA pegadinha já registrada em `promessa-de-canal` (onde `confirma\w*\s+chega` não casava
    "confirmação chega"), e eu a repeti sabendo dela. Delimitar por `\s` em vez de `\b` resolve, e o
    autoteste abaixo cobre as duas grafias para que não volte.
  */
  {
    padrao: /(?:\bquem|voc[êe])\s[^.!?]{0,40}?\b(atende|trabalha|cuida)\s+sozinh[oa]\b/i,
    porque: '"sozinho/sozinha" escolhe um gênero; o §C.4 manda reescrever sem ("quem trabalha por conta")',
  },
]

/**
 * `src/lib` entrou em 2026-09-03, e não por simetria: o cartão do Grátis em `planos-cartoes.ts`
 * dizia "Você atende sozinho e quer sair do caderno" e a guarda passava verde, porque copy de
 * produto não mora só em `app/` e `components/`. `planos-cartoes.ts` é lido pela página pública de
 * preço E pela tela "Meu plano" — é a copy que a pessoa lê antes de pagar.
 *
 * `src/server` fica de fora aqui de propósito: a copy dele que interessa (`mensagens-prontas.ts`)
 * tem asserção própria mais abaixo, sobre o array tipado em vez de sobre o texto do arquivo.
 */
const RAIZES = ['src/app', 'src/components', 'src/lib']

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    // `.ts` também, e não só `.tsx`: `planos-cartoes.ts` é copy de produto sem uma linha de JSX.
    else if (/[.]tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

const TELAS = RAIZES.flatMap(arquivos).map((f) => f.split(String.fromCharCode(92)).join('/'))

describe('o leitor deste teste', () => {
  it('enxerga as telas — não passa por não ter olhado nada', () => {
    expect(TELAS.length).toBeGreaterThan(80)
  })

  it('o alcance inclui os arquivos onde o defeito JÁ apareceu', () => {
    /*
     * Guarda contra a cegueira de RAIZ, que é diferente da cegueira de padrão e não é pega por
     * nenhuma asserção acima: tirar `src/lib` da lista deixa `TELAS.length` bem acima de 80 e a
     * suíte inteira verde, com "Você atende sozinho" de volta na copy que a pessoa lê antes de
     * pagar. Medido em 2026-09-03 — a mutação passou verde antes desta asserção existir.
     *
     * Os dois arquivos nomeados aqui não são exemplo: são os dois onde o defeito foi encontrado de
     * verdade. Arquivo que já falhou uma vez é o que precisa estar no alcance por escrito.
     */
    for (const ondeJaFalhou of ['src/lib/planos-cartoes.ts', 'src/app/(auth)/entrar/page.tsx']) {
      expect(TELAS, `${ondeJaFalhou} saiu do alcance da guarda`).toContain(ondeJaFalhou)
    }
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

  it('pega "sozinho" E "sozinha" falando de pessoa, e poupa "sozinho" de coisa', () => {
    /*
     * O §C.4 do `docs/20`: escolher o feminino não é melhor que escolher o masculino. As duas
     * formas reprovam, e a saída é reescrever sem gênero.
     */
    expect(SUPOE_HOMEM.some((r) => r.padrao.test('quem atende sozinho')), 'masculino').toBe(true)
    expect(SUPOE_HOMEM.some((r) => r.padrao.test('quem atende sozinha')), 'feminino também erra').toBe(true)
    /*
     * Com "Você" ACENTUADO, que é a forma que a copy real usa — e a que a versão anterior deste
     * padrão deixava passar, porque `\b` depois de `ê` nunca casa em JS. Sem esta linha, a guarda
     * volta a ser cega no dia em que alguém "arrumar" o regex de volta para `\b`.
     */
    expect(
      SUPOE_HOMEM.some((r) => r.padrao.test("paraQuem: 'Você atende sozinho e quer sair do caderno.',")),
      'a frase real do cartão do Grátis, com acento',
    ).toBe(true)
    /*
     * E o que está CERTO. As duas primeiras não são exemplo inventado: são a copy real de
     * `/admin/config/automacoes` e do hub, que a primeira versão deste padrão reprovou. Ficam aqui
     * para que a exceção seja protegida — se alguém alargar o regex de novo, o teste grita.
     */
    for (const certo of [
      'O que o CICLO faz sozinho por você, e o quanto de rédea você dá para cada coisa.',
      'O que o CICLO faz sozinho, e quanta rédea você dá',
      'o lembrete sai sozinho',
      'o job roda sozinho',
    ]) {
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

/**
 * A QUARTA superfície, e a que a guarda acima não alcança por construção.
 *
 * As 17 profissões da `0022` guardam um `vocab` (cliente, atendimento, profissional, servico,
 * agenda, local) para o produto falar a língua de cada uma: psicólogo lê "paciente", personal lê
 * "treino". A chave `profissional` nomeia **quem usa o produto**, e vem no masculino em sete
 * profissões: barbeiro, professor, fotógrafo, jardineiro, técnico, tatuador, psicólogo. Em
 * `cliente` há mais duas: aluno e tutor.
 *
 * **Por que isto precisa de guarda própria:** as asserções acima varrem `src/`, os modelos de
 * mensagem e o prompt — tudo TypeScript. Este vocabulário mora em **seed SQL**, então a palavra
 * nunca aparece no fonte e a suíte segue verde enquanto a tela chama a barbeira de "barbeiro". É a
 * guarda cega de raiz: a varredura não olha onde o defeito mora.
 *
 * As chaves que nomeiam COISA ficam de fora de propósito — sessão, treino, aula, faxina, ensaio,
 * trabalho, salão, estúdio não têm o problema, e proibi-las seria ruído sem defeito.
 */
describe('o vocabulário das profissões não supõe o gênero de quem usa o produto', () => {
  /** As duas chaves que nomeiam PESSOA. As outras nomeiam coisa e não entram. */
  const CHAVES_DE_PESSOA = ['profissional', 'cliente']
  const SEPARADOR = ' '

  /**
   * Neutro = serve para qualquer pessoa sem trocar de forma. A lista é explícita porque a regra
   * morfológica não existe: "cliente", "paciente" e "personal" terminam diferente e são neutros;
   * "aluno" e "técnico" seguem o padrão do masculino. Palavra nova entra aqui só depois de alguém
   * olhar, que é o ponto.
   */
  const NEUTRAS = new Set(['cliente', 'paciente', 'profissional', 'personal', 'estudante', 'pessoa', 'artista', 'terapeuta', 'docente', 'responsável'])

  /**
   * O vocabulário EFETIVO, e não o literal do `insert`.
   *
   * A correção de gênero veio como migration de `update` (a `0060`), porque migration já aplicada
   * não se edita. Uma guarda que lesse só o literal do seed continuaria acusando "barbeiro" para
   * sempre, e a saída fácil seria afrouxar a asserção — que é onde a proteção morre. Aqui ela lê
   * os `insert` e depois aplica os `jsonb_set` na ordem dos arquivos, que é o que o banco faz.
   */
  function vocabulariosEfetivos(): { chave: string; valor: string }[] {
    const arquivos = readdirSync('supabase/migrations').filter((a) => a.endsWith('.sql')).sort()
    const vocabs: Record<string, string>[] = []
    const correcoes: { chave: string; para: string; de: string[] }[] = []

    for (const arquivo of arquivos) {
      const sql = readFileSync(join('supabase', 'migrations', arquivo), 'utf8')
      for (const bruto of sql.match(/\{"cliente":[^}]*\}/g) ?? []) vocabs.push(JSON.parse(bruto) as Record<string, string>)
      /*
       * O SQL e achatado antes de casar: um `update` de migration ocupa varias linhas, e padrao
       * multilinha escrito a mao ja quebrou tres vezes nesta sessao por escape que nao sobrevive
       * ao caminho ate o arquivo. Achatar troca o problema por um mais simples.
       */
      const plano = sql.split(new RegExp(String.raw`\s+`, 'g')).join(SEPARADOR)
      const reUpdate = new RegExp(
        String.raw`jsonb_set\(vocab, '\{(\w+)\}', '"([^"]+)"'\) where vocab->>'\w+' (?:=|in) \(?([^;]+?)\)?;`,
        'g',
      )
      for (const m of plano.matchAll(reUpdate)) {
        correcoes.push({ chave: m[1], para: m[2], de: [...m[3].matchAll(/'([^']+)'/g)].map((x) => x[1]) })
      }
    }
    for (const c of correcoes)
      for (const v of vocabs) {
        const atual = v[c.chave]
        if (atual !== undefined && c.de.includes(atual)) v[c.chave] = c.para
      }

    const saida: { chave: string; valor: string }[] = []
    for (const v of vocabs) for (const chave of CHAVES_DE_PESSOA) if (v[chave]) saida.push({ chave, valor: v[chave] })
    return saida
  }

  const DO_SEED = vocabulariosEfetivos()

  it('o leitor achou os vocabulários — não passa por ter varrido lista vazia', () => {
    // Piso por CONTAGEM e por CONTEÚDO: um regex que para de casar devolveria zero, e zero
    // violação sobre zero linha é o falso verde que este projeto persegue.
    expect(DO_SEED.length, 'nenhum vocabulário lido das migrations').toBeGreaterThanOrEqual(20)
    expect(DO_SEED.some((v) => v.valor === 'paciente'), 'não achei o vocabulário do psicólogo').toBe(true)
  })

  it('nenhuma palavra que nomeia pessoa vem só no masculino', () => {
    const errados = DO_SEED.filter((v) => !NEUTRAS.has(v.valor)).map((v) => `${v.chave}="${v.valor}"`)
    expect(
      [...new Set(errados)],
      'o vocabulário da profissão nomeia a pessoa no masculino. Quem usa o produto leria o ' +
        'próprio papel no gênero errado, e nenhuma outra guarda pega isto: o valor mora em seed ' +
        'SQL e nunca aparece no fonte. Use a palavra neutra, ou deixe a chave com o padrão.',
    ).toEqual([])
  })
})
