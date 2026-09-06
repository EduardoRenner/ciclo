import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `/api/health` é o único endpoint da base que responde sem autenticação nenhuma e **sem passar
 * pelo `rota()`** — é o contrato dele: monitor de uptime externo bate de fora, sem credencial.
 *
 * Isso faz de todo texto que sai de `health.ts` texto público. E `error.message` do Postgres não
 * é: carrega nome de tabela, de coluna, de constraint, e num erro de unicidade carrega o **valor**
 * que colidiu — `Key (phone_e164)=(+5511...) already exists`. Cinco checagens devolviam esse
 * `message` cru; no dia em que o banco tossisse, o telefone de uma cliente sairia por um endpoint
 * anônimo.
 *
 * Esta guarda casa com a **devolução** (`detail: ...error.message`), não com a string
 * `error.message` solta: ela aparece de propósito no comentário que explica o conserto, e casar
 * com ela reprovaria o próprio arquivo que documenta a correção — a armadilha nº2 da tabela do
 * CLAUDE.md ("case com o que muda quando o defeito volta").
 */

const CAMINHO = 'src/server/services/health.ts'
const FONTE = readFileSync(CAMINHO, 'utf8')

describe('/api/health não devolve erro cru do banco para quem não está autenticado', () => {
  it('o leitor enxerga o arquivo — senão a guarda passa vazia', () => {
    const codigo = semComentarios(FONTE)
    // Se o arquivo mudar de nome ou a limpeza de comentário comer tudo, isto grita.
    expect(codigo).toContain('async function checarBanco')
    expect(codigo).toContain('falhaSemVazar')
  })

  it('nenhuma checagem devolve `error.message` no corpo da resposta', () => {
    const codigo = semComentarios(FONTE)
    const ecos = [...codigo.matchAll(/detail:\s*[^,\n}]*\.message/g)].map((m) => m[0])
    expect(
      ecos,
      'Mensagem de erro do Postgres carrega schema e, num erro de unicidade, o valor que colidiu — ' +
        'e este endpoint responde a qualquer um, sem autenticação. Use `falhaSemVazar`.',
    ).toEqual([])
  })

  it('o detalhe real continua indo para o log do servidor', () => {
    // O conserto não pode virar silêncio: quem opera precisa do erro de verdade em algum lugar.
    expect(semComentarios(FONTE)).toMatch(/console\.error[\s\S]{0,200}health_check_falhou/)
  })
})
