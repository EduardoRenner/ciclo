import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Auditoria de segurança de 31/08/2026.
 *
 * A auditoria anterior (achado S4) pôs limite próprio em `book` e `availability` e parou aí.
 * Medido agora: das **11** rotas sob `api/v1/public/`, **9 não tinham limite nenhum** — só o teto
 * global de 120/min do `rota()`, que é `somenteMemoria: true` e portanto não conta entre
 * instâncias. Num deploy serverless isso vale por lambda viva, não por IP.
 *
 * Entre as desprotegidas estavam as QUATRO que mudam estado por link assinado (confirmar/cancelar
 * agendamento, aprovar/recusar orçamento), a que escreve avaliação, e o perfil público inteiro —
 * que sai em várias consultas por chamada e tem slug enumerável pelo `sitemap.xml`.
 *
 * Esta guarda é de CLASSE, não de caso: rota pública nova nasce coberta ou reprova aqui. É o
 * único jeito de a correção não virar "os 9 de hoje, e o 12º de amanhã de novo esquecido".
 */

const RAIZ_PUBLICA = 'src/app/api/v1/public'

/** Os verbos HTTP que o Next expõe — cada um é uma porta de entrada separada. */
const VERBOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

function rotas(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...rotas(caminho))
    else if (entrada.name === 'route.ts') achados.push(caminho)
  }
  return achados
}

const ARQUIVOS = rotas(RAIZ_PUBLICA).map((f) => f.split(String.fromCharCode(92)).join('/'))

/**
 * Casa com a CHAMADA, nunca com o import: `limitarRotaPublica` sozinho aparece na linha de
 * `import` de qualquer arquivo que só o importou e esqueceu de usar — que é exatamente o defeito
 * que esta guarda existe para pegar (armadilha nº1 da tabela do CLAUDE.md).
 *
 * `limitador(` também vale: `book` e `availability` têm limites próprios, mais finos (por telefone,
 * por dia), montados antes deste helper existir. Trocá-los por um limite genérico seria piorar.
 */
const CHAMA_LIMITE = /\b(limitarRotaPublica|limitador)\s*\(/

describe('o leitor desta guarda', () => {
  it('acha as rotas públicas — senão ela passa vazia', () => {
    expect(ARQUIVOS.length, 'nenhuma rota pública encontrada — o caminho mudou?').toBeGreaterThanOrEqual(10)
  })

  it('não confunde import com chamada', () => {
    expect(CHAMA_LIMITE.test("import { limitarRotaPublica } from '@/server/http/limite-publico'")).toBe(false)
    expect(CHAMA_LIMITE.test("await limitarRotaPublica(req, 'perfil')")).toBe(true)
    expect(CHAMA_LIMITE.test('const { permitido } = await limitador(`avail:ip:${ip}`, LIMITE)')).toBe(true)
  })
})

describe('toda rota pública tem limite por IP', () => {
  it.each(ARQUIVOS)('%s chama o limitador', (arquivo) => {
    const fonte = semComentarios(readFileSync(arquivo, 'utf8'))

    // Só cobra de arquivo que de fato exporta handler — um `route.ts` só com tipos não é porta.
    const exporta = VERBOS.filter((v) => new RegExp(`export const ${v}\\s*=`).test(fonte))
    if (exporta.length === 0) return

    expect(
      CHAMA_LIMITE.test(fonte),
      `${arquivo} exporta ${exporta.join('/')} sem limite por IP. Rota pública é alcançável por ` +
        'qualquer um sem sessão, e o teto global do `rota()` é `somenteMemoria` — não conta entre ' +
        'instâncias. Use `limitarRotaPublica(req, escopo)` (LIMITE_ACAO para link que muda estado).',
    ).toBe(true)
  })
})

describe('o corpo tem teto antes de virar objeto', () => {
  /*
   * `req.json()` carrega o corpo INTEIRO na memória antes do Zod ver o primeiro campo — o `max()`
   * de cada schema chegava tarde. A Vercel corta em ~4,5 MB, mas esse é o limite de outra pessoa:
   * some em self-host, container e dev local, e não está escrito neste repositório.
   */
  const BODY = semComentarios(readFileSync('src/server/http/body.ts', 'utf8'))

  it('existe um teto de tamanho declarado', () => {
    const m = BODY.match(/TAMANHO_MAX_CORPO\s*=\s*([\d*\s]+)/)
    expect(m, 'sumiu o teto de tamanho de corpo').not.toBeNull()
  })

  it('o teto é conferido ANTES do parse — depois já gastou a memória', () => {
    /*
     * Esta asserção NASCEU CEGA e foi pega pela própria mutação (31/08/2026). A primeira versão
     * comparava `BODY.indexOf('TAMANHO_MAX_CORPO')` com o `JSON.parse` — e o primeiro
     * `TAMANHO_MAX_CORPO` do arquivo é a **declaração da constante**, lá no topo, que está antes
     * do parse aconteça o que acontecer. Mover a checagem para depois do parse passava verde.
     *
     * O que muda quando o defeito volta é a posição da COMPARAÇÃO, não a da declaração — então é
     * nela que a guarda ancora.
     */
    const comparacao = /Buffer\.byteLength\([^)]*\)\s*>\s*TAMANHO_MAX_CORPO/.exec(BODY)
    expect(comparacao, 'sumiu a comparação de bytes contra o teto').not.toBeNull()

    const posParse = BODY.indexOf('JSON.parse')
    expect(posParse, 'o parse sumiu').toBeGreaterThan(-1)
    expect(
      comparacao!.index,
      'o parse passou a acontecer ANTES da checagem de tamanho — a memória já foi gasta quando o teto reprova',
    ).toBeLessThan(posParse)
  })

  it('não confia só no content-length, que é dica de quem chamou', () => {
    // Sem a contagem real, corpo sem `content-length` (chunked) passa direto.
    expect(BODY, 'sumiu a contagem real de bytes — só o header não prova nada').toContain('Buffer.byteLength')
  })
})
