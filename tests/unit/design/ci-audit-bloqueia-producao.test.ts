import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Decisão de 2026-10-08: o `pnpm audit` BLOQUEANTE da CI olha só o que vai para produção (`--prod`), porque as
 * duas vulnerabilidades da árvore de desenvolvimento (`tinypool` via vitest, `braces` via eslint-config-next)
 * não têm correção possível hoje e deixavam o check "Segredos" vermelho em todo PR.
 *
 * A guarda impede o afrouxamento pela metade: tirar o `--prod` de volta (volta o vermelho permanente) ou
 * tirar o `high` (deixa passar vulnerabilidade de produção) ou apagar a chamada que mostra a árvore inteira.
 */
const yml = readFileSync('.github/workflows/ci.yml', 'utf8')
  .split('\n')
  .filter((l) => !/^\s*#/.test(l))
  .join('\n')

describe('o audit da CI', () => {
  it('bloqueia em severidade alta ou acima, só no que vai para produção', () => {
    expect(yml).toMatch(/saida=\$\(pnpm audit --prod --audit-level high /)
  })

  it('a árvore inteira continua aparecendo no log, sem quebrar o build', () => {
    expect(yml).toMatch(/pnpm audit --audit-level moderate \|\| true/)
  })
})
