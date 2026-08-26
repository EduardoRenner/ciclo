import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * O runbook de incidente é lido no pior momento possível: produção quebrada, pressa, ninguém
 * conferindo se a instrução ainda vale. Uma linha errada ali custa minutos que ninguém tem.
 *
 * Ele mandava "desabilitar o cron específico em `vercel.json` + redeploy". O `vercel.json` fica
 * com `crons: []` **de propósito e para sempre** (`docs/18` §L.5) — o agendador é o GitHub
 * Actions. Seguir a instrução à risca não desligaria nada, e a pessoa só descobriria isso depois
 * do redeploy.
 *
 * É a terceira vez que a mesma confusão de arquivo aparece neste repositório: primeiro numa guarda
 * de copy (`tests/helpers/cron.ts`), depois na receita comentada do próprio `cron.yml`, agora
 * aqui. Por isso a linha vira teste em vez de só correção.
 */
const RUNBOOK = 'docs/runbooks/incidente.md'

describe('o runbook de incidente aponta para o agendador de verdade', () => {
  const texto = readFileSync(RUNBOOK, 'utf8')

  it('a leitura não voltou vazia', () => {
    expect(texto.length, `${RUNBOOK} veio vazio — o teste passaria por não achar nada`).toBeGreaterThan(500)
  })

  it('não manda desligar cron no vercel.json', () => {
    const linhasSuspeitas = texto
      .split('\n')
      .filter((l) => /vercel\.json/.test(l))
      .filter((l) => !/de propósito|não desliga|fica com/.test(l))
    expect(
      linhasSuspeitas,
      'o runbook manda mexer no vercel.json para lidar com cron — o agendador é o GitHub Actions ' +
        '(.github/workflows/cron.yml); só é permitido citar o vercel.json para dizer que ele NÃO resolve',
    ).toEqual([])
  })

  it('nomeia o arquivo que realmente agenda', () => {
    expect(texto).toContain('.github/workflows/cron.yml')
  })
})
