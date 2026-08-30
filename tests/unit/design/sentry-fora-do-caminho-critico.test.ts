import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * L-10, `docs/31-LANCAMENTO-AUDITORIA-E-PLANO.md` — a guarda que faltava em cima de um conserto
 * caro que já foi feito e que **nada protegia**.
 *
 * ## O que o `docs/28` pagou para descobrir
 *
 * Medido em 26 e 27/08: `@sentry/nextjs` importado no topo do módulo viajava no grafo estático de
 * tudo. No navegador eram **129 kB dos 188 kB de First Load JS** — metade do que a tela baixa era
 * observabilidade que não observava, num produto mobile-first para quem atende de celular em 4G
 * ruim. No servidor era pior: **1,58 MB** no chunk que toda rota de `/api/v1` carrega e **~500 ms
 * de `require` em todo cold start**, num projeto de tráfego baixo onde quase toda visita É um
 * cold start.
 *
 * E não havia nada do outro lado da balança: não existe `SENTRY_DSN` em produção, então o SDK
 * inicializava com `dsn: undefined`, instalava auto-instrumentação de OpenTelemetry em cima de
 * todo `http` de saída (inclusive de toda chamada ao Supabase) e **não mandava um evento sequer**.
 *
 * O conserto foi trocar `import` por `import()` dinâmico nos dois lados: sem DSN o `import()`
 * vira código morto e o empacotador descarta o SDK; com DSN o comportamento é o de antes, só que
 * num chunk próprio, fora do caminho crítico.
 *
 * ## Por que esta guarda existe
 *
 * O conserto está feito e **nada impedia alguém de desfazê-lo**. Um `import * as Sentry from
 * '@sentry/nextjs'` no topo de qualquer arquivo traz os 1,58 MB e os 500 ms de volta — sem erro,
 * sem aviso, e sem que ninguém perceba até alguém remedir o bundle. Foi assim que a regressão
 * nasceu da primeira vez.
 *
 * A segunda metade guarda a regra 9 do `CLAUDE.md` ("dado de saúde nunca em log, Sentry ou
 * analytics"): se `Sentry.init` deixar de passar pela redação, dado sensível de cliente começa a
 * sair da casa no primeiro erro.
 */

const RAIZES = ['src']
const MODULO_SENTRY = '@sentry/nextjs'

/**
 * Os únicos arquivos onde o SDK pode ser mencionado. Lista fechada de propósito: "arquivo que
 * parece de observabilidade" abriria a porta para qualquer módulo novo entrar sem justificar.
 */
const PODEM_CARREGAR = ['src/instrumentation.ts', 'src/instrumentation-client.ts', 'src/app/global-error.tsx']

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/[.]tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

const TODOS = RAIZES.flatMap(arquivos).map((f) => f.split(String.fromCharCode(92)).join('/'))

/** `import ... from '@sentry/nextjs'` — o estático, que entra no grafo. Não casa com `import(`. */
function temImportEstatico(fonte: string): boolean {
  return new RegExp(`import\\s+[^;]*?from\\s*['"]${MODULO_SENTRY}['"]`).test(fonte)
}

/** `import('@sentry/nextjs')` — o dinâmico, que é o permitido. */
function temImportDinamico(fonte: string): boolean {
  return new RegExp(`import\\s*\\(\\s*['"]${MODULO_SENTRY}['"]\\s*\\)`).test(fonte)
}

describe('a leitura deste teste', () => {
  it('enxerga os arquivos do projeto', () => {
    expect(TODOS.length, 'nenhum .ts/.tsx encontrado — o varredor quebrou').toBeGreaterThan(80)
  })

  it('os detectores distinguem import estático de dinâmico', () => {
    // Guarda contra o próprio detector: se os dois casassem igual, a regra inteira viraria enfeite.
    const estatico = `import * as Sentry from '${MODULO_SENTRY}'`
    const dinamico = `const s = import('${MODULO_SENTRY}').then(x => x)`
    expect(temImportEstatico(estatico)).toBe(true)
    expect(temImportDinamico(estatico)).toBe(false)
    expect(temImportEstatico(dinamico)).toBe(false)
    expect(temImportDinamico(dinamico)).toBe(true)
  })

  it('os arquivos que podem carregar o SDK existem e realmente o carregam', () => {
    // Se um deles for renomeado, a lista acima vira ficção e a guarda passa protegendo nada.
    for (const arquivo of PODEM_CARREGAR) {
      const fonte = readFileSync(arquivo, 'utf8')
      expect(fonte.includes(MODULO_SENTRY), `${arquivo} não menciona mais o SDK — a lista precisa ser revista`).toBe(true)
    }
  })
})

describe('o SDK do Sentry não volta para o caminho crítico', () => {
  it('nenhum arquivo importa o SDK estaticamente', () => {
    const infratores = TODOS.filter((f) => temImportEstatico(readFileSync(f, 'utf8')))

    expect(
      infratores,
      `estes arquivos importam "${MODULO_SENTRY}" no topo, o que devolve o SDK ao grafo estático: ` +
        '129 kB no First Load JS de toda tela e 1,58 MB + ~500 ms de cold start em toda rota de ' +
        'API — para um SDK que hoje não manda evento nenhum, porque não existe DSN em produção. ' +
        'Use `await import("@sentry/nextjs")` dentro da função, como fazem instrumentation.ts e ' +
        'instrumentation-client.ts. Ver docs/28 §6.',
    ).toEqual([])
  })

  it('quem carrega o SDK usa a forma dinâmica', () => {
    const semDinamico = PODEM_CARREGAR.filter((f) => {
      const fonte = readFileSync(f, 'utf8')
      // `global-error.tsx` é o boundary do React e usa o SDK já carregado; só os dois de
      // instrumentação é que fazem o carregamento em si.
      if (!f.includes('instrumentation')) return false
      return !temImportDinamico(fonte)
    })

    expect(
      semDinamico,
      'estes arquivos deixaram de carregar o SDK por `import()` — sem isso o empacotador não ' +
        'consegue mais descartá-lo quando não há DSN',
    ).toEqual([])
  })
})

describe('o Sentry nunca manda evento sem passar pela redação', () => {
  /*
   * Regra 9 do CLAUDE.md virando teste. O produto guarda anamnese e alergia; um evento de erro
   * carregando o corpo da requisição levaria dado de saúde para fora da casa. `redigirEventoSentry`
   * é o único caminho, e `beforeSend`/`beforeSendTransaction` são os dois ganchos por onde tudo
   * passa antes de sair.
   */
  const INICIALIZAM = ['src/instrumentation.ts', 'src/instrumentation-client.ts']

  it.each(INICIALIZAM)('%s redige antes de enviar', (arquivo) => {
    const fonte = readFileSync(arquivo, 'utf8')

    expect(/Sentry\.init\s*\(/.test(fonte), `${arquivo} não inicializa mais o SDK — o teste precisa ser revisto`).toBe(true)

    for (const gancho of ['beforeSend', 'beforeSendTransaction']) {
      expect(
        new RegExp(`${gancho}\\s*:\\s*\\([^)]*\\)\\s*=>\\s*redigirEventoSentry`).test(fonte),
        `${arquivo} não passa mais por redigirEventoSentry em \`${gancho}\`. Este produto guarda ` +
          'dado de saúde (anamnese, alergia): sem a redação, o primeiro erro leva isso para fora ' +
          'da casa. É a regra 9 do CLAUDE.md.',
      ).toBe(true)
    }
  })
})
