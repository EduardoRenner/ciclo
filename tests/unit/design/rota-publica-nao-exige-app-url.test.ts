import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * CI de 21/10 (job de banco, PR #155): `cancelar por token público` respondia 500 com "Variável de
 * ambiente ausente: NEXT_PUBLIC_APP_URL". A rota pública passava `exigirEnv('NEXT_PUBLIC_APP_URL')`
 * como argumento FORA do `.catch` do aviso à lista de espera, e o job de banco não tem a variável.
 * Localmente o `.env.local` sempre tem, então a integração nunca pegava aqui.
 *
 * Rota pública (quem não está logado) usa `APP_URL` de `lib/app-url`, a fonte única com o domínio
 * de reserva: um aviso que falha não pode derrubar a ação da cliente.
 */
function rotas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) return rotas(caminho)
    return e.name === 'route.ts' ? [caminho] : []
  })
}

describe('rota pública não exige NEXT_PUBLIC_APP_URL', () => {
  const publicas = rotas('src/app/api/v1/public')

  it('a varredura acha as rotas públicas (guarda contra passar vazia)', () => {
    expect(publicas.some((r) => r.split(String.fromCharCode(92)).join('/').includes('appointments/cancel'))).toBe(true)
  })

  it.each(publicas)('%s', (rota) => {
    expect(semComentarios(readFileSync(rota, 'utf8'))).not.toMatch(/exigirEnv\(\s*['"]NEXT_PUBLIC_APP_URL['"]/)
  })
})
