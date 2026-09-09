import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A inviolável nº 5 do `CLAUDE.md`: **"Regra de negócio em `src/core/`, funções puras, sem I/O.
 * `core/` não importa de `server/` nem de `app/`."**
 *
 * Ela estava cumprida e sem guarda. Medido em 2026-09-09: 77 arquivos em `src/core`, e o conjunto
 * INTEIRO de coisas que eles importam de fora da própria pasta são duas bibliotecas
 * (`@js-temporal/polyfill` e `zod`). Nenhuma linha aponta para `server/`, `app/` ou `components/`.
 *
 * ## Por que o import importa mais do que parece
 *
 * Não é arrumação de pastas. Um único import de `core/` para `server/` arrasta o grafo inteiro do
 * servidor para dentro do pacote de quem lê `core/` — e quem lê `core/` é a **página pública do
 * salão**. Já aconteceu de forma medida nesta base: um caminho de import até `media-upload.ts`
 * levaria os 19,2 MB do `sharp` para a rota pública, e é por isso que
 * `tests/unit/server/sharp-so-onde-precisa.test.ts` existe. `core/text/vitrine.ts` cita essa
 * armadilha no próprio cabeçalho.
 *
 * Por isso a lista de pacotes externos é de PERMITIDOS, com motivo, e não de proibidos: peso novo
 * em `core/` chega na página que o cliente do salão abre no 3G dele, e a decisão de pagar esse
 * custo tem que ser tomada por alguém, não herdada por descuido. Lista de proibidos protege só do
 * que já aconteceu — a mesma lição do `Gemini · schema derruba todas as ferramentas`.
 */
const RAIZ = 'src/core'

/** O que a regra nomeia, literalmente. */
const PASTAS_PROIBIDAS = ['@/server', '@/app', '@/components']

/**
 * Pacotes externos que `core/` pode usar, com o motivo. Os dois são de cálculo puro e nenhum abre
 * conexão: `Temporal` é a aritmética de data e fuso (a regra nº 4 depende dela), `zod` é a forma
 * dos dados. Qualquer terceiro entra aqui por decisão explícita, não por um import que passou.
 */
const PACOTES_PERMITIDOS: Record<string, string> = {
  '@js-temporal/polyfill': 'aritmética de data/fuso, pura — a inviolável nº 4 é escrita em cima dela',
  zod: 'forma dos dados, sem I/O; a validação de borda da nº 7 reusa os mesmos esquemas',
}

/**
 * As marcas de I/O e de ambiente. Não é uma lista de tudo que existe — é a lista do que apareceria
 * primeiro se alguém "só precisasse de uma consultinha" dentro de `core/`.
 */
const MARCAS_DE_IO = [
  { marca: 'fetch(', porque: 'rede' },
  { marca: 'node:', porque: 'módulo de sistema (fs, crypto, path)' },
  { marca: 'createClient', porque: 'cliente de banco' },
  { marca: 'localStorage', porque: 'armazenamento do navegador' },
  { marca: 'process.env', porque: 'estado de ambiente: a mesma entrada passa a dar saídas diferentes' },
]

/**
 * A ÚNICA exceção, e ela é nominal.
 *
 * `urlDaVitrine` lê `NEXT_PUBLIC_SUPABASE_URL` para montar o endereço público de uma imagem. É
 * impureza de verdade — mesma entrada, saída diferente conforme o ambiente —, e fica assim por
 * medição, não por preguiça: a função tem nove chamadores, três deles client components, e passar a
 * origem como argumento significaria enfiar uma prop nova em cada caminho. `NEXT_PUBLIC_*` é
 * substituída no BUILD pelo Next, então na prática é constante de compilação e não leitura em
 * tempo de execução. Trocar isso por um refatoração de nove pontos é o tipo de conserto que sai
 * mais caro que o defeito.
 *
 * O piso abaixo é o que impede a exceção de apodrecer: se `vitrine.ts` parar de ler o env, a
 * exceção tem que sair da lista no mesmo commit.
 */
const EXCECOES: Record<string, string> = {
  'src/core/text/vitrine.ts':
    'lê NEXT_PUBLIC_SUPABASE_URL, que o Next substitui no build; nove chamadores, três deles client component',
}

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/[.]tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

const TODOS = arquivos(RAIZ).map((f) => f.split(String.fromCharCode(92)).join('/'))

function codigo(arquivo: string): string {
  return semComentarios(readFileSync(arquivo, 'utf8'))
}

/** Todo destino de `import ... from '<x>'` e de `import('<x>')`. */
function importados(arquivo: string): string[] {
  const alvos: string[] = []
  const padrao = /from\s+'([^']+)'|import\('([^']+)'\)/g
  let m = padrao.exec(codigo(arquivo))
  while (m !== null) {
    alvos.push(m[1] ?? m[2] ?? '')
    m = padrao.exec(codigo(arquivo))
  }
  return alvos.filter(Boolean)
}

describe('o leitor deste teste', () => {
  it('achou o core — não passa por ter varrido pasta vazia', () => {
    expect(TODOS.length, 'nenhum arquivo em src/core — o caminho mudou?').toBeGreaterThan(50)
    // Afirmado por nome: os dois onde a regra é mais fácil de quebrar. `catalogo.ts` é copy de
    // produto morando em core, e `vitrine.ts` é o único com exceção aberta.
    expect(TODOS).toContain('src/core/automacoes/catalogo.ts')
    expect(TODOS).toContain('src/core/text/vitrine.ts')
  })

  it('enxerga os imports que existem', () => {
    // Controle positivo: se o extrator quebrar, as asserções de ausência abaixo passariam vazias.
    const todos = TODOS.flatMap(importados)
    expect(todos, 'o extrator não achou nem o Temporal').toContain('@js-temporal/polyfill')
    expect(todos.length).toBeGreaterThan(10)
  })
})

describe('core/ não conhece o mundo', () => {
  it('não importa de server/, app/ nem components/', () => {
    const fora: string[] = []
    for (const arquivo of TODOS) {
      for (const alvo of importados(arquivo)) {
        if (PASTAS_PROIBIDAS.some((p) => alvo === p || alvo.startsWith(`${p}/`))) fora.push(`${arquivo} → ${alvo}`)
      }
    }
    expect(
      fora,
      'a inviolável nº 5: `core/` não importa de `server/` nem de `app/`. Não é arrumação de ' +
        'pastas — um caminho de import daqui arrasta o grafo do servidor para o pacote da PÁGINA ' +
        'PÚBLICA do salão (foi assim que o `sharp` de 19,2 MB quase entrou nela). Inverta: quem ' +
        'chama passa o dado pronto.',
    ).toEqual([])
  })

  it('não ganha dependência externa sem alguém decidir', () => {
    const novos: string[] = []
    for (const arquivo of TODOS) {
      for (const alvo of importados(arquivo)) {
        // Relativo ou dentro do próprio core: é a pasta falando com ela mesma.
        if (alvo.startsWith('.') || alvo.startsWith('@/core/')) continue
        if (PASTAS_PROIBIDAS.some((p) => alvo === p || alvo.startsWith(`${p}/`))) continue
        const pacote = alvo.startsWith('@') ? alvo.split('/').slice(0, 2).join('/') : (alvo.split('/')[0] ?? alvo)
        if (!(pacote in PACOTES_PERMITIDOS)) novos.push(`${arquivo} → ${pacote}`)
      }
    }
    expect(
      [...new Set(novos)],
      'dependência nova em `core/`. O peso chega na página pública do salão, no 3G do cliente ' +
        'dele. Se for de cálculo puro e valer o custo, entre em PACOTES_PERMITIDOS com o motivo.',
    ).toEqual([])
  })

  it('não faz I/O nem lê ambiente, salvo a exceção nomeada', () => {
    const impuros: string[] = []
    for (const arquivo of TODOS) {
      const fonte = codigo(arquivo)
      for (const { marca, porque } of MARCAS_DE_IO) {
        if (!fonte.includes(marca)) continue
        if (arquivo in EXCECOES) continue
        impuros.push(`${arquivo} → ${marca} (${porque})`)
      }
    }
    expect(
      impuros,
      'a inviolável nº 5: `core/` é função pura. Mesma entrada, mesma saída, sempre — é o que ' +
        'deixa a regra de negócio testável sem banco, sem rede e sem relógio.',
    ).toEqual([])
  })

  it('a exceção aberta continua sendo verdade', () => {
    /*
      A direção que apodrece em silêncio. Exceção que sobrevive ao motivo dela vira permissão
      permanente para quem vier depois: o próximo `process.env` em `vitrine.ts` entra sem discussão
      porque o arquivo "já é exceção". Se a impureza sumir, a linha sai da lista no mesmo commit.
    */
    for (const [arquivo, motivo] of Object.entries(EXCECOES)) {
      expect(TODOS, `${arquivo} está na lista de exceções e não existe mais`).toContain(arquivo)
      expect(motivo.length, `${arquivo} está isento sem motivo escrito`).toBeGreaterThan(20)
      const aindaImpuro = MARCAS_DE_IO.some(({ marca }) => codigo(arquivo).includes(marca))
      expect(aindaImpuro, `${arquivo} ficou puro — tire-o da lista de exceções`).toBe(true)
    }
  })
})
