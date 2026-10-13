import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * APR-023 (achado C-37): o convite de equipe montava `${NEXT_PUBLIC_APP_URL}/convite/${token}` e a
 * página `/convite` não existia — 404, e a equipe não tinha como entrar. Nada reprovava: o link sai
 * numa resposta de API, e o teste da rota só confere o formato.
 *
 * Todo link que o código monta com a URL do app (`${...APP_URL...}/<pasta>/${...}` ou
 * `${appUrl}/<pasta>/${...}`) precisa ter a pasta `<pasta>` em algum lugar de `src/app` (grupo de
 * rota entre parênteses vale).
 */
const LINK_DO_APP = /\$\{([^}]*(?:APP_URL|appUrl)[^}]*)\}\/([a-z][a-z-]*)\/\$\{/g

function segmentos(fonte: string): string[] {
  return [...semComentarios(fonte).matchAll(LINK_DO_APP)].map((m) => m[2]!)
}

function arquivos(dir: string, filtro: RegExp): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho, filtro)
    return filtro.test(nome) ? [caminho] : []
  })
}

function pastas(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    return statSync(caminho).isDirectory() ? [nome, ...pastas(caminho)] : []
  })
}

const PASTAS_DO_APP = new Set(pastas('src/app'))
const montados = arquivos('src', /\.tsx?$/).flatMap((arquivo) => segmentos(readFileSync(arquivo, 'utf8')).map((seg) => ({ arquivo, seg })))

describe('link montado com a URL do app tem página (APR-023)', () => {
  it('controle positivo: o detector acha os dois jeitos de montar e ignora o comentário', () => {
    expect(segmentos('const l = `${exigirEnv(\'NEXT_PUBLIC_APP_URL\')}/convite/${token}`')).toEqual(['convite'])
    expect(segmentos('const l = `${appUrl}/confirmar/${token}`')).toEqual(['confirmar'])
    expect(segmentos('// `${appUrl}/fantasma/${token}`\n')).toEqual([])
  })

  it('acha os links conhecidos (não passa vazia)', () => {
    const vistos = new Set(montados.map((m) => m.seg))
    for (const seg of ['avaliar', 'confirmar', 'convite', 'lista-espera', 'orcamento']) expect(vistos, seg).toContain(seg)
  })

  it('todo link montado aponta para uma pasta que existe em src/app', () => {
    const orfaos = montados.filter((m) => !PASTAS_DO_APP.has(m.seg)).map((m) => `${m.arquivo.replaceAll('\\', '/')}: /${m.seg}/`)
    expect(orfaos).toEqual([])
  })
})
