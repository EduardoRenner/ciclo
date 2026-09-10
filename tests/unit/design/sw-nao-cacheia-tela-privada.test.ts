import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A inviolável do `CLAUDE.md` ("armadilhas conhecidas"): *"Cachear resposta de `/vault` ou mídia
 * assinada no service worker: proibido"*. O `public/sw.js` cumpre com uma deny-list por PREFIXO de
 * caminho, generalizada para toda rota que exige sessão.
 *
 * Deny-list por prefixo tem um jeito específico de apodrecer: ela não erra, ela fica **incompleta**.
 * Uma tela privada nova fora de `/admin` (um `/relatorios`, um `/financeiro`) nasce cacheável, e o
 * sintoma é a segunda pessoa a abrir o tablet do balcão herdar a tela renderizada da primeira,
 * sobrevivendo ao logout dela. Nada quebra, nenhum teste fica vermelho.
 *
 * Foi exatamente assim que o conserto de um job desta base deixou o irmão dele sem vigia por cinco
 * dias: a guarda iterava uma lista escrita à mão em vez da lista real. Esta itera **o disco**.
 *
 * ## As duas fontes são lidas, nunca copiadas
 *
 * O padrão vem do próprio `sw.js` e os prefixos protegidos do próprio `middleware.ts`. Reescrever
 * qualquer um dos dois aqui criaria a segunda cópia da mesma fórmula, e duas cópias com a sua
 * própria guarda divergem com as duas suítes verdes.
 */

const SW = 'public/sw.js'
const MIDDLEWARE = 'src/middleware.ts'

/** O regex de verdade que roda no navegador, lido do arquivo que o navegador baixa. */
function denyListDoServiceWorker(): RegExp {
  const fonte = readFileSync(SW, 'utf8')
  const m = /const NUNCA_CACHEAR = \/(.+?)\/\s*\n/.exec(fonte)
  if (!m?.[1]) throw new Error(`não achei NUNCA_CACHEAR em ${SW}: a guarda ficaria sem o que conferir`)
  return new RegExp(m[1])
}

/** Os prefixos que o middleware realmente protege, lidos do middleware. */
function prefixosProtegidos(): string[] {
  const fonte = readFileSync(MIDDLEWARE, 'utf8')
  const m = /PREFIXOS_PROTEGIDOS = \[(.*?)\]/s.exec(fonte)
  if (!m?.[1]) throw new Error(`não achei PREFIXOS_PROTEGIDOS em ${MIDDLEWARE}`)
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]!)
}

/** Toda rota do App Router, do DISCO: cada `page.tsx` é um caminho servido. */
function rotasDoDisco(dir = 'src/app', prefixo = ''): string[] {
  const achadas: string[] = []
  let temPage = false
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      // Grupo `(auth)` não entra na URL; `[id]` vira um segmento qualquer.
      const segmento = /^\(.+\)$/.test(e.name) ? '' : `/${e.name.replace(/^\[(.+)\]$/, 'X')}`
      achadas.push(...rotasDoDisco(join(dir, e.name), prefixo + segmento))
    } else if (e.name === 'page.tsx') {
      temPage = true
    }
  }
  if (temPage) achadas.push(prefixo || '/')
  return achadas
}

const DENY = denyListDoServiceWorker()
const PROTEGIDOS = prefixosProtegidos()
const ROTAS = [...new Set(rotasDoDisco())]

const exigeSessao = (rota: string) => PROTEGIDOS.some((p) => rota === p || rota.startsWith(`${p}/`))

describe('o leitor desta guarda', () => {
  it('achou as três fontes: nenhuma afirmação abaixo passa vazia', () => {
    expect(ROTAS.length, 'a varredura do disco não achou rota nenhuma').toBeGreaterThan(20)
    expect(PROTEGIDOS.length).toBeGreaterThan(0)
    // Positivos conhecidos, por nome: se a varredura parar de achar estes, ela quebrou.
    expect(ROTAS).toContain('/admin/hoje')
    expect(ROTAS).toContain('/precos')
  })

  it('o padrão lido do sw.js é o de verdade, não um que casa com tudo', () => {
    // Controle positivo: uma rota PÚBLICA precisa passar pela deny-list. Um regex frouxo (`/.*/`)
    // deixaria todos os casos abaixo verdes por negar o site inteiro, inclusive a landing.
    expect(DENY.test('/precos'), 'a deny-list está negando rota pública: o regex casa demais').toBe(false)
    expect(DENY.test('/'), 'a deny-list está negando a landing').toBe(false)
    // E um negativo conhecido, para provar que ela nega alguma coisa.
    expect(DENY.test('/admin/hoje')).toBe(true)
  })
})

describe('o service worker não guarda tela privada', () => {
  it('toda rota que o middleware protege está na deny-list do sw.js', () => {
    const furos = ROTAS.filter((r) => exigeSessao(r) && !DENY.test(r))
    expect(
      furos,
      'tela privada que o service worker cacharia. Cache do SW é indexado só por URL: a segunda ' +
        'pessoa a abrir o tablet do balcão herdaria a tela renderizada da primeira, e ela ' +
        'sobreviveria ao logout. Acrescente o prefixo em `NUNCA_CACHEAR` (public/sw.js).',
    ).toEqual([])
  })

  it('as rotas de credencial também estão negadas, mesmo sem exigir sessão', () => {
    // `/entrar`, `/cadastro`, `/nova-senha` não passam pelo `PREFIXOS_PROTEGIDOS` (quem está
    // deslogado precisa vê-las), e mesmo assim não podem ficar guardadas: são as telas onde a
    // pessoa digita senha, e uma versão velha em cache é a que some com o campo novo.
    for (const rota of ['/entrar', '/cadastro', '/nova-senha', '/recuperar-senha']) {
      expect(ROTAS, `${rota} sumiu do disco: a afirmação abaixo passaria vazia`).toContain(rota)
      expect(DENY.test(rota), `${rota} ficou cacheável no service worker`).toBe(true)
    }
  })

  it('nenhuma rota sob /api entra no cache do SW', () => {
    // O middleware não marca `/api` como "exige sessão" de propósito (precisa de 401 em JSON, não
    // de 302), então a regra acima não a cobre. Esta cobre: `/vault` e mídia assinada vivem ali.
    expect(DENY.test('/api/v1/clients/X/vault')).toBe(true)
    expect(DENY.test('/api/v1/media/X/url')).toBe(true)
    expect(DENY.test('/api')).toBe(true)
  })
})
