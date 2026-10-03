import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ROTAS_DE_ESCRITA } from '@/core/billing/pausa'

import { semComentarios } from '../../helpers/fonte'

/**
 * C5: a pausa recusa criar em TODA rota de escrita, e a prova é a tabela de `core/billing/pausa.ts`
 * coincidir, nos dois sentidos, com os arquivos `route.ts` que existem. Rota nova que ninguém
 * classificou reprova aqui, em vez de nascer deixando a conta pausada criar.
 */
const RAIZ_DA_API = join('src', 'app', 'api')

function arquivosDeRota(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome)
    if (statSync(caminho).isDirectory()) return arquivosDeRota(caminho)
    return nome === 'route.ts' ? [caminho] : []
  })
}

type Rota = { chave: string; rota: string; arquivo: string; fonte: string }

const ROTAS: Rota[] = arquivosDeRota(RAIZ_DA_API).flatMap((arquivo) => {
  const rota = relative(RAIZ_DA_API, arquivo).split(sep).slice(0, -1).join('/')
  const fonte = semComentarios(readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n'))
  const metodos = [...fonte.matchAll(/export const (POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]!)
  return metodos.map((m) => ({ chave: `${m} ${rota}`, rota, arquivo, fonte }))
})

describe('toda rota de escrita está classificada para a pausa', () => {
  it('o leitor achou as rotas (controle contra varredura vazia)', () => {
    expect(ROTAS.length).toBeGreaterThan(90)
    expect(ROTAS.some((r) => r.chave === 'POST v1/clients')).toBe(true)
  })

  it('nenhuma rota de escrita existe sem linha na tabela', () => {
    const faltam = ROTAS.filter((r) => !(r.chave in ROTAS_DE_ESCRITA)).map((r) => r.chave)
    expect(
      faltam,
      `Rota de escrita sem classificação em core/billing/pausa.ts: ${faltam.join(', ')}. Pergunta: o negócio ganha uma linha nova que não tinha? Sim: 'bloqueia'. Não: 'permite'.`,
    ).toEqual([])
  })

  it('nenhuma linha da tabela aponta para rota que não existe mais', () => {
    const existentes = new Set(ROTAS.map((r) => r.chave))
    const sobram = Object.keys(ROTAS_DE_ESCRITA).filter((k) => !existentes.has(k))
    expect(sobram, `Linhas da tabela sem rota: ${sobram.join(', ')}`).toEqual([])
  })

  it('"bloqueia" e "permite" só valem para rota que PASSA por contextoAtual (a chamada, não o import)', () => {
    const mentem = ROTAS.filter((r) => ROTAS_DE_ESCRITA[r.chave] !== 'fora' && !/await contextoAtual\(/.test(r.fonte)).map((r) => r.chave)
    expect(mentem, `Classificadas como alcançadas pela trava, mas sem chamar contextoAtual: ${mentem.join(', ')}`).toEqual([])
  })

  it('"fora" só vale para rota que NÃO passa por contextoAtual (senão a linha mente para quem lê)', () => {
    const mentem = ROTAS.filter((r) => ROTAS_DE_ESCRITA[r.chave] === 'fora' && /await contextoAtual\(/.test(r.fonte)).map((r) => r.chave)
    expect(mentem, `Marcadas "fora", mas chamam contextoAtual: ${mentem.join(', ')}`).toEqual([])
  })

  it('o controle positivo existe: há rotas que bloqueiam e rotas que permitem, e a trava está ligada em contextoAtual', () => {
    const regras = new Set(ROTAS.map((r) => ROTAS_DE_ESCRITA[r.chave]))
    expect(regras.has('bloqueia') && regras.has('permite') && regras.has('fora')).toBe(true)
    const tenant = semComentarios(readFileSync('src/server/auth/tenant.ts', 'utf8').replace(/\r\n/g, '\n'))
    // As DUAS saídas de contextoAtual passam pela trava: a que usa o cookie/header e a do vínculo único.
    expect([...tenant.matchAll(/return travaDaPausa\(req, /g)]).toHaveLength(2)
    expect(tenant).toMatch(/exigirContaQueEscreve\(req\.method, new URL\(req\.url\)\.pathname, ctx\.tenant\.plan, ctx\.tenant\.cortesia\)/)
  })
})
