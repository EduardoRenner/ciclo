import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * A trava de "banco atrás do código" mora em `tests/setup/banco-em-dia.ts` e só chega às suítes
 * porque `vitest.banco.config.ts` a pendura no `setupFiles`. Tirar uma linha do config desliga a
 * proteção inteira **sem nenhum teste ficar vermelho** — e o sintoma de estar desligada é
 * justamente tudo continuar verde.
 *
 * Este arquivo é a guarda da guarda, no mesmo padrão que `teste-nao-toca-producao.test.ts` já usa
 * para a trava irmã (a que recusa banco remoto).
 *
 * ## O incidente que fez isso existir (2026-09-10)
 *
 * O banco local estava com **80 migrations aplicadas contra 83 no disco** — faltavam a `0081`, a
 * `0082` e a `0083`, que são o lote de recorte de RLS. O `pnpm verify` passou inteiro no verde,
 * **`test:rls` incluído**: 332 casos aprovaram um banco onde as políticas que eles existem para
 * checar ainda não tinham sido criadas.
 *
 * O mesmo buraco já tinha quebrado `/admin/hoje` no local (faltava a view da `0058`) e a produção
 * em 2026-09-04.
 */

const CONFIG = 'vitest.banco.config.ts'
const SETUP = 'tests/setup/banco-em-dia.ts'

const config = readFileSync(CONFIG, 'utf8')

describe('as suítes que abrem o banco recusam schema defasado', () => {
  it('a leitura do config não voltou vazia', () => {
    // Piso: sem isto, um caminho errado faria todos os casos abaixo passarem por não achar nada.
    expect(config.length, `${CONFIG} veio vazio`).toBeGreaterThan(200)
    expect(config).toContain('setupFiles')
  })

  it('o config pendura a trava pelo CAMINHO do arquivo', () => {
    // Casa com o caminho dentro da chamada, não com o nome solto — o nome aparece neste próprio
    // arquivo e nos comentários por outro motivo (armadilha nº 1 do CLAUDE.md).
    const declaracao = config.indexOf('setupFiles')
    expect(declaracao).toBeGreaterThan(-1)
    expect(
      config.slice(declaracao).includes(SETUP),
      `${CONFIG} parou de carregar ${SETUP}: sem ele, uma suíte inteira roda contra um banco atrás ` +
        `do código e o verde não afirma nada. Foi exatamente o que aconteceu em 2026-09-10.`,
    ).toBe(true)
  })

  it('a trava de banco remoto vem ANTES da de schema', () => {
    // Invertido, a checagem de schema abriria conexão com um Supabase remoto antes de a outra
    // trava ter a chance de recusar. A ordem é a proteção, não o gosto.
    const remoto = config.indexOf('so-banco-local.ts')
    const schema = config.indexOf(SETUP)
    expect(remoto, 'sumiu a trava de banco remoto').toBeGreaterThan(-1)
    expect(schema, 'sumiu a trava de schema').toBeGreaterThan(-1)
    expect(remoto, 'a checagem de schema passou a rodar antes da recusa de banco remoto').toBeLessThan(schema)
  })

  it('a trava usa a MESMA comparação do /api/health, não uma segunda cópia da regra', () => {
    // Duas definições da mesma fórmula divergem com as duas suítes verdes — armadilha registrada
    // na casa. Se alguém reescrever a comparação aqui dentro, este caso reprova.
    const setup = readFileSync(SETUP, 'utf8')
    expect(setup.length, `${SETUP} veio vazio`).toBeGreaterThan(400)
    expect(
      setup.includes('compararSchema'),
      `${SETUP} parou de usar \`compararSchema\` (core/schema/versao.ts). Reimplementar a regra ` +
        `aqui cria a segunda cópia, e as duas divergem sem ninguém ver.`,
    ).toBe(true)
  })

  it('falha de leitura AMBÍGUA não derruba a suíte — alarme permanente é proibido', () => {
    // A distinção que `compararSchema` e a vigia de schema já fazem: reprovar só o que dá para
    // PROVAR. Um erro de permissão local não pode tornar `pnpm verify` impossível de rodar.
    const setup = readFileSync(SETUP, 'utf8')
    expect(setup).toContain('PGRST202')
    expect(
      /if \(error \|\| !data\)[\s\S]{0,200}grite\(/.test(setup),
      'o caminho de erro ambíguo parou de apenas avisar: se ele passar a lançar, uma diferença de ' +
        'permissão local trava o verify de todo mundo',
    ).toBe(true)
  })
})
