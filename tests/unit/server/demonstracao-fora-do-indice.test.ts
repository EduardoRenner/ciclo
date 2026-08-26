import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { SLUGS_DE_DEMONSTRACAO_PARA_TESTE, ehDemonstracao } from '@/core/tenants/demonstracao'

/**
 * O tenant de demonstração tem cinco caminhos para o mundo, e eles precisam concordar. Os três
 * originais evitam expor o tenant ao buscador:
 *
 *   1. o `sitemap.ts`, que entregava o slug ao buscador como estabelecimento real;
 *   2. o `robots` da própria página, para o caso de o buscador chegar por um link qualquer;
 *   3. o aviso visível, que é o único que alcança quem abre a URL direto — por um print, um link
 *      no WhatsApp, um resultado antigo de busca.
 *
 * Os outros dois (F0, `docs/25-ESTRATEGIA-E-EXECUCAO.md`) evitam mandar mensagem de verdade para
 * um tenant que não tem cliente de verdade do outro lado do telefone:
 *
 *   4. `lembretes.ts`, que identifica confirmação/lembrete de agendamento a enviar;
 *   5. a rota de `campaigns`, que dispara campanha de recuperação por tenant.
 *
 * Se um deles esquecer a regra, volta a existir um caminho que expõe o que os outros escondem —
 * e o sintoma é silencioso: a página funciona perfeitamente, com agendamento ligado, num
 * estabelecimento que não existe (ou o WhatsApp sai para um número que não existe). Ver
 * `docs/20-COPY-PLANO.md` §A.4.1.
 *
 * Este teste lê os arquivos de verdade em vez de confiar que alguém lembrou.
 */

const SITEMAP = 'src/app/sitemap.ts'
const PAGINA = 'src/app/(public)/[slug]/page.tsx'
const LEMBRETES = 'src/server/services/lembretes.ts'
const CAMPAIGNS_ROUTE = 'src/app/api/cron/campaigns/route.ts'

/**
 * F0 (`docs/25-ESTRATEGIA-E-EXECUCAO.md`) acrescentou mais dois leitores: as rotas de cron que
 * mandam mensagem de verdade para cliente final. Um tenant de demonstração não pode receber
 * WhatsApp/e-mail automático — mesmo risco de regressão silenciosa que motivou este arquivo.
 */
const TODOS_OS_LEITORES: ReadonlyArray<[string, string]> = [
  ['o sitemap', SITEMAP],
  ['a página pública', PAGINA],
  ['os lembretes', LEMBRETES],
  ['a rota de campanhas', CAMPAIGNS_ROUTE],
]

describe('a regra de demonstração', () => {
  it('reconhece os slugs semeados, e ignora caixa e espaço', () => {
    expect(ehDemonstracao('dom-rocha')).toBe(true)
    expect(ehDemonstracao('  DOM-ROCHA ')).toBe(true)
    expect(ehDemonstracao('ruivo-barber')).toBe(true)
  })

  it('não pega um negócio de verdade pelo caminho', () => {
    for (const real of ['barbearia-do-ze', 'studio-ana', 'dom-rocha-oficial', 'rocha']) {
      expect(ehDemonstracao(real), `${real} foi tratado como demonstração`).toBe(false)
    }
  })

  it('a lista não está vazia', () => {
    // Guarda contra alguém "resolver" esvaziando a lista: aí tudo passa e nada protege.
    expect(SLUGS_DE_DEMONSTRACAO_PARA_TESTE.length).toBeGreaterThan(0)
  })
})

describe('os cinco caminhos para o mundo usam a mesma regra', () => {
  it.each(TODOS_OS_LEITORES)('%s importa a regra do core em vez de repetir a lista', (_nome, arquivo) => {
    const src = readFileSync(arquivo, 'utf8')
    expect(
      /import\s*\{[^}]*ehDemonstracao[^}]*\}\s*from\s*'@\/core\/tenants\/demonstracao'/.test(src),
      `${arquivo} não importa ehDemonstracao — a regra precisa vir de um lugar só`,
    ).toBe(true)
  })

  it.each(TODOS_OS_LEITORES)('%s não datilografa nenhum slug de demonstração', (_nome, arquivo) => {
    /*
     * O jeito errado de resolver isto é colar `slug !== 'dom-rocha'` no arquivo. Funciona hoje e
     * some na próxima demonstração que alguém semear. Comentário citando o slug é documentação —
     * o que não pode é o CÓDIGO conhecer o nome.
     */
    const semComentarios = readFileSync(arquivo, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')

    const culpados = SLUGS_DE_DEMONSTRACAO_PARA_TESTE.filter((slug) => semComentarios.includes(slug))
    expect(culpados, `${arquivo} tem slug de demonstração escrito à mão: ${culpados.join(', ')}`).toEqual([])
  })

  it('a página pública marca noindex e mostra o aviso', () => {
    const src = readFileSync(PAGINA, 'utf8')
    expect(/robots:\s*ehDemonstracao\(/.test(src), 'falta o noindex condicional no generateMetadata').toBe(true)
    expect(/\{ehDemonstracao\([^)]*\)\s*\?/.test(src), 'falta o aviso visível condicional no corpo da página').toBe(true)
  })

  it('o sitemap filtra antes de montar a lista de URLs', () => {
    const src = readFileSync(SITEMAP, 'utf8')
    expect(/\.filter\(\([^)]*\)\s*=>\s*!ehDemonstracao\(/.test(src), 'o sitemap não filtra os tenants de demonstração').toBe(true)
  })
})
