import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * APR-040: `exigirPermissao` devolve o ALCANCE (`all` | `own`), e o `own` do profissional só vale se
 * a rota usar o retorno. Medido na APR-039: das 123 chamadas, 2 usavam. O resto tratava `own` como
 * `all` — e o cofre abria a ficha de saúde de qualquer cliente para qualquer profissional.
 *
 * Recursos com `own` em algum papel (`rbac.ts`): appointment, client, vault, comanda, commission.
 * Chamada desses recursos cujo retorno é JOGADO FORA entra nesta linha de base, que só encolhe.
 * Rota nova, ou mais chamadas num arquivo listado, reprova: use `const escopo = exigirPermissao(...)`
 * e decida o que `own` significa ali (ver `exigirClienteDoProfissional`, `exigirComandaPropria`).
 */
const LINHA_DE_BASE: Record<string, number> = {
  'appointments/[id]/arrive/route.ts': 1,
  'appointments/[id]/complete/route.ts': 1,
  'appointments/[id]/confirm/route.ts': 1,
  'appointments/[id]/no-show/route.ts': 1,
  'appointments/[id]/route.ts': 2,
  'appointments/route.ts': 2,
  'appointments/series/[id]/cancel/route.ts': 1,
  'appointments/series/route.ts': 1,
  'clients/[id]/data-export/route.ts': 1,
  'clients/export/route.ts': 1,
  'clients/import/preview/route.ts': 1,
  'clients/import/route.ts': 1,
  'clients/ja-atendo/route.ts': 1,
  'clients/route.ts': 2,
  'cycle/attribution/route.ts': 1,
  'cycle/recover/manual/route.ts': 1,
  'cycle/recover/route.ts': 1,
  'media/[id]/publish/route.ts': 2,
  'media/[id]/route.ts': 1,
  'media/[id]/url/route.ts': 1,
  'message-templates/route.ts': 1,
  'packages/[id]/use/route.ts': 1,
  'packages/route.ts': 2,
  'quotes/[id]/convert/route.ts': 1,
  'quotes/route.ts': 1,
  'subscription-plans/route.ts': 1,
  'tickets/[id]/cancel/route.ts': 1,
  'tickets/[id]/items/[itemId]/route.ts': 1,
  'tickets/[id]/items/route.ts': 1,
  'tickets/[id]/route.ts': 2,
  'vault/access-log/route.ts': 1,
  'waitlist/route.ts': 2,
  'wallet/credit/route.ts': 1,
  'wallet/debit/route.ts': 1,
  'wallet/route.ts': 1,
}

/** A chamada como INSTRUÇÃO solta (retorno descartado) — `const escopo = exigirPermissao(` não casa. */
const ALCANCE_DESCARTADO = /^[ \t]*exigirPermissao\(ctx\.papel, '(?:appointment|client|vault|comanda|commission):[a-z]+'\)/gm

function contar(fonte: string): number {
  return fonte.match(ALCANCE_DESCARTADO)?.length ?? 0
}

function rotas(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return rotas(caminho)
    return nome === 'route.ts' ? [caminho] : []
  })
}

const API = join(process.cwd(), 'src/app/api/v1')
const encontradas = new Map<string, number>()
for (const arquivo of rotas(API)) {
  const n = contar(readFileSync(arquivo, 'utf8'))
  if (n > 0) encontradas.set(relative(API, arquivo).replaceAll('\\', '/'), n)
}

function fonte(rel: string): string {
  return readFileSync(join(API, rel), 'utf8')
}

describe('rotas usam o alcance own (APR-040)', () => {
  it('controle positivo: o detector casa com a chamada solta e não com a que guarda o alcance', () => {
    expect(contar(`  exigirPermissao(ctx.papel, 'client:update')\n`)).toBe(1)
    expect(contar(`  const escopo = exigirPermissao(ctx.papel, 'client:update')\n`)).toBe(0)
    expect(contar(`  exigirPermissao(ctx.papel, 'service:update')\n`)).toBe(0)
  })

  it('a varredura enxerga rotas (não passa vazia)', () => {
    expect(encontradas.size).toBeGreaterThan(10)
  })

  it('nenhuma rota nova ignora o alcance, nem cresce a contagem de uma listada', () => {
    const excessos = [...encontradas]
      .filter(([rota, n]) => n > (LINHA_DE_BASE[rota] ?? 0))
      .map(([rota, n]) => `${rota}: ${n} (linha de base ${LINHA_DE_BASE[rota] ?? 0})`)
    expect(excessos).toEqual([])
  })

  it('a linha de base acompanha a realidade (consertou? baixe o número)', () => {
    const sobras = Object.entries(LINHA_DE_BASE)
      .filter(([rota, n]) => (encontradas.get(rota) ?? 0) < n)
      .map(([rota, n]) => `${rota}: linha de base ${n}, encontrado ${encontradas.get(rota) ?? 0}`)
    expect(sobras).toEqual([])
  })

  it('o cofre de saúde confere o alcance nas duas operações, antes de abrir', () => {
    const cofre = fonte('clients/[id]/vault/route.ts')
    expect(cofre.match(/if \(escopo === 'own'\) await exigirClienteDoProfissional\(/g)).toHaveLength(2)
    // A checagem vem antes da abertura com o cliente de serviço — depois, a trilha já teria a linha.
    expect(cofre.indexOf('exigirClienteDoProfissional(')).toBeLessThan(cofre.indexOf('withTenant('))
  })

  it('remover cliente e eliminar dados recusam o alcance own', () => {
    for (const rota of ['clients/[id]/route.ts', 'clients/[id]/erase/route.ts']) {
      expect(fonte(rota), rota).toMatch(/if \(escopo === 'own'\) throw new AppError\('FORBIDDEN'/)
    }
  })

  it('campanha, modelo de mensagem e envio pelo sistema são do negócio: own recusa', () => {
    for (const rota of ['campaigns/route.ts', 'message-templates/[id]/route.ts', 'cycle/recover/send/route.ts']) {
      expect(fonte(rota), rota).toMatch(/if \(escopo === 'own'\) throw new AppError\('FORBIDDEN'/)
    }
  })
})
