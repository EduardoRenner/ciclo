import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Nenhum script do `package.json` pode redirecionar (`>`) para dentro de um arquivo versionado.
 *
 * `db:types` era exatamente isso:
 *
 *   supabase gen types typescript --project-id $SUPABASE_PROJECT_REF > src/server/db/types.gen.ts
 *
 * O `>` do shell TRUNCA o destino ANTES de o comando rodar, e `SUPABASE_PROJECT_REF` so existe na
 * Vercel — na maquina de quem desenvolve ela e vazia. Reproduzido em 31/08 sobre uma COPIA
 * descartavel: 3.590 linhas viraram 1, com `{"_tag":"Error", ...}` dentro. E o `supabase gen types`
 * saiu com codigo 0 enquanto imprimia esse erro no stdout — entao nem "o comando falhou" servia de
 * aviso.
 *
 * O arquivo destruido e o de tipos de que o app inteiro depende. Ja aconteceu nesta base e foi
 * recuperado do git.
 */
const BARRA = String.fromCharCode(92)
const PASTAS_VERSIONADAS = ['src', 'supabase', 'tests'].flatMap((p) => [p + '/', p + BARRA])

const PACOTE = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }

describe('script nao trunca arquivo versionado', () => {
  it('ha scripts para conferir', () => {
    expect(Object.keys(PACOTE.scripts).length).toBeGreaterThan(5)
  })

  for (const [nome, comando] of Object.entries(PACOTE.scripts)) {
    it(`${nome} nao redireciona para src/`, () => {
      /*
       * So `>` para dentro de `src/`, `supabase/` ou `tests/`. Redirecionar para /dev/null, para
       * arquivo temporario ou para `2>&1` continua permitido — o que mata e apontar o truncamento
       * para codigo que esta no git.
       */
      const depoisDoMaior = comando.split('>').slice(1).map((t) => t.trimStart())
      const perigoso = depoisDoMaior.some((t) => PASTAS_VERSIONADAS.some((p) => t.startsWith(p)))
      expect(
        perigoso,
        `${nome} redireciona a saida para dentro do repositorio: "${comando}". ` +
          'O `>` trunca o destino ANTES do comando rodar — se ele falhar, o arquivo versionado vira ' +
          'a mensagem de erro. Escreva por um script que valide a saida antes de gravar ' +
          '(ver scripts/gerar-types.mjs).',
      ).toBe(false)
    })
  }

  it('db:types passa por um script que valida antes de gravar', () => {
    expect(PACOTE.scripts['db:types'], 'db:types voltou a ser redirecionamento direto').toContain('gerar-types.mjs')
    expect(PACOTE.scripts['db:types:local'], 'db:types:local voltou a ser redirecionamento direto').toContain(
      'gerar-types.mjs',
    )
  })

  it('o gerador confere a saida antes de tocar no arquivo', () => {
    const gerador = readFileSync('scripts/gerar-types.mjs', 'utf8')
    // As tres checagens existem porque o comando sai com 0 imprimindo erro no stdout.
    expect(gerador, 'sumiu a checagem de tamanho').toContain('curta demais')
    expect(gerador, 'sumiu a checagem de forma').toContain('export type Json')
    expect(gerador, 'sumiu a checagem de conteudo real').toContain('tenants:')
    // E o writeFileSync tem que vir DEPOIS das checagens.
    const posChecagem = gerador.indexOf("tenants:")
    const posEscrita = gerador.indexOf('writeFileSync(DESTINO')
    expect(posEscrita, 'a escrita voltou a acontecer antes das checagens').toBeGreaterThan(posChecagem)
  })
})

describe('db:reset tem a trava que o FAQ promete', () => {
  /*
   * Ate 31/08 o FAQ B23 respondia "e bloqueado por guard no package.json quando
   * NODE_ENV=production" e o script era so `supabase db reset`. Nao havia trava nenhuma.
   *
   * Promessa de seguranca falsa e pior que a ausencia dela: quem le o FAQ age com a confianca de
   * quem tem rede. E o perigo real nao e NODE_ENV — e `--linked`, porque linkar e passo normal
   * para `db push`, e o `.env.local` desta casa aponta para PRODUCAO.
   */
  it('o script passa pela trava, nao direto pro supabase', () => {
    expect(PACOTE.scripts['db:reset'], 'db:reset voltou a chamar `supabase db reset` sem trava').toContain(
      'db-reset.mjs',
    )
  })

  it('a trava recusa banco remoto e --linked', () => {
    const trava = readFileSync('scripts/db-reset.mjs', 'utf8')
    expect(trava, 'sumiu a recusa de --linked').toContain('--linked')
    // `localhost`, e nao `127.0.0.1`: no fonte o IP aparece escapado dentro do regex
    // (`127BARRA.0BARRA.0BARRA.1`), entao casar com a forma sem escape reprovava um script correto.
    expect(trava, 'sumiu a regra de URL local').toContain('localhost')
    expect(trava, 'a trava parou de olhar a URL do Supabase').toContain('NEXT_PUBLIC_SUPABASE_URL')
    expect(trava, 'sumiu o escape consciente').toContain('PERMITIR_BANCO_REMOTO')
  })

  it('o FAQ descreve a trava que existe, nao uma inventada', () => {
    const faq = readFileSync('docs/05-FAQ-DEV.md', 'utf8')
    expect(faq, 'o FAQ voltou a prometer um guard por NODE_ENV que nunca existiu').not.toContain(
      'bloqueado por guard no `package.json` quando `NODE_ENV=production`',
    )
    expect(faq, 'o FAQ nao aponta para a trava real').toContain('scripts/db-reset.mjs')
  })
})
