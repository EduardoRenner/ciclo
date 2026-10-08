import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/101 §6.3 e anexo 05 §5: toda rota da API do pacote Advocacia exige segundo fator, confere o
 * pacote do tenant e trava pelo módulo. A porta de MFA do painel (`contextoDoPainel`) não alcança a
 * API, que é chamável sem a tela.
 *
 * Casa com a CHAMADA (`await exigirAal2()`), nunca com o nome solto que o `import` já traria. E tem
 * piso: a varredura precisa achar as rotas que existem, senão passaria vazia (memória
 * `guarda-que-varre-passa-vazia`).
 */
const RAIZ = join('src', 'app', 'api', 'v1', 'legal')

function rotas(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const c = join(dir, n)
    return statSync(c).isDirectory() ? rotas(c) : n === 'route.ts' ? [c] : []
  })
}

// rotas do pacote fora de `v1/legal` entram pelo nome: a varredura da pasta não as alcançaria
const FORA_DA_PASTA = [join('src', 'app', 'api', 'v1', 'tenant', 'advocacia', 'route.ts')]
const ARQUIVOS = [...rotas(RAIZ), ...FORA_DA_PASTA]

describe('rotas v1/legal', () => {
  it('a varredura achou as rotas que existem (piso pelo positivo conhecido)', () => {
    const nomes = ARQUIVOS.map((a) => a.split(String.fromCharCode(92)).join('/'))
    expect(nomes).toContain('src/app/api/v1/legal/cases/route.ts')
    expect(nomes).toContain('src/app/api/v1/legal/checklist/[id]/route.ts')
    expect(nomes).toContain('src/app/api/v1/legal/intimations/[id]/decide/route.ts')
    expect(nomes).toContain('src/app/api/v1/tenant/advocacia/route.ts')
  })

  it.each(ARQUIVOS)('%s exige segundo fator, pacote e módulo em todo handler de escrita', (arquivo) => {
    const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
    const handlers = [...fonte.matchAll(/export const (POST|PUT|PATCH|DELETE) = rota\(async[\s\S]*?\n\}\)/g)].map((m) => m[0])
    expect(handlers.length, 'nenhum handler de escrita lido: o detector cegou').toBeGreaterThan(0)
    for (const h of handlers) {
      expect(/await exigirAal2\(\)/.test(h), 'handler sem segundo fator').toBe(true)
      expect(/ctx\.tenant\.pacote !== 'advocacia'/.test(h), 'handler sem conferir o pacote').toBe(true)
      expect(/await exigirModulo\(db, ctx\.tenantId, 'legal_[a-z_]+'\)/.test(h), 'handler sem trava de módulo').toBe(true)
      expect(/comIdempotencia\(/.test(h), 'handler sem idempotência').toBe(true)
    }
  })
})
