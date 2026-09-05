import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * **No supabase-js, um `update` que não casa linha nenhuma devolve `error: null`.** Sucesso, zero
 * linhas. Quem só olha o `error` não distingue "gravei" de "não havia o que gravar" — e segue em
 * frente como se tivesse gravado.
 *
 * Isso só é perigoso quando o `where` carrega uma **guarda** além da identidade: `.eq('status',
 * 'pending')`, `.is('deleted_at', null)`, uma chave composta que outra rotina pode ter reescrito.
 * Com identidade pura (`tenant_id` + `id`), zero linhas quer dizer que o registro não existe, e
 * isso o chamador em geral já tratou.
 *
 * **O caso que originou a guarda** (05/09/2026): `recuperar-receita.ts` gravava
 * `last_campaign_at` DEPOIS de a mensagem ter saído. Zero linhas ali — corrida com o
 * `recompute_cycles`, que reescreve `client_cycles` seis vezes por dia — significa que a trava de
 * 7 dias fica sem o que ler, e a mesma cliente recebe "sentimos sua falta" outra vez no lote
 * seguinte. Sem erro, sem log, sem nada na tela. Quem paga é o salão, na conversa com a cliente.
 *
 * **Como funciona:** `update` novo com guarda no `where` e sem conferir linhas afetadas reprova.
 * Se for legítimo, entra na lista abaixo **com o motivo escrito** — o custo de justificar é o
 * ponto, porque é nesse momento que se pensa no que acontece quando não casa nada. Mesma mecânica
 * de `consulta-filtra-tenant`.
 */

/** Colunas que são IDENTIDADE, não guarda: casar zero nelas é "não existe", não "mudou de estado". */
const IDENTIDADE = new Set(['tenant_id', 'id'])

type Dispensa = { arquivo: string; guarda: string; porque: string }

const DISPENSADAS: Dispensa[] = [
  {
    arquivo: 'src/server/services/media.ts',
    guarda: 'deleted_at',
    porque:
      'idempotente de propósito e documentado no código: apagar de novo uma foto já apagada (duplo ' +
      'toque, aba dupla) não pode virar 404, e o `despublicarDoPortfolio` roda depois de qualquer jeito',
  },
  {
    arquivo: 'src/server/http/idempotency.ts',
    guarda: 'key',
    porque:
      'a linha da chave foi criada nesta mesma requisição, segundos antes; só a faxina de retenção a ' +
      'remove, e ela só alcança chave velha',
  },
]

const RAIZ = join('src', 'server')

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return nome.endsWith('.ts') ? [caminho.split(String.fromCharCode(92)).join('/')] : []
  })
}

/** Cada `.update(` com o trecho de cadeia que o segue, já sem comentário. */
function updatesDe(fonte: string): { trecho: string; guardas: string[]; confere: boolean }[] {
  const limpo = semComentarios(fonte)
  const saida: { trecho: string; guardas: string[]; confere: boolean }[] = []
  for (const m of limpo.matchAll(/\.update\(/g)) {
    const inicio = m.index ?? 0
    // Delimita pelo fim do statement (linha em branco), nunca por contagem de caracteres.
    const fim = limpo.indexOf('\n\n', inicio)
    const trecho = limpo.slice(inicio, fim > 0 ? fim : inicio + 700)
    const guardas = [...trecho.matchAll(/\.(?:eq|neq|in|is|lt|gt|lte|gte)\(\s*'([a-z_]+)'/g)]
      .map((g) => g[1]!)
      .filter((c) => !IDENTIDADE.has(c))
    // conferir = pedir as linhas de volta (`.select(`) ou a contagem
    const confere = /\.select\(|count:\s*'exact'/.test(trecho)
    saida.push({ trecho, guardas: [...new Set(guardas)], confere })
  }
  return saida
}

describe('a varredura enxerga alguma coisa', () => {
  it('acha arquivos e updates de sobra', () => {
    const todos = arquivos(RAIZ)
    expect(todos.length, `varredura de ${RAIZ} devolveu ${todos.length} arquivos`).toBeGreaterThan(50)
    const updates = todos.flatMap((f) => updatesDe(readFileSync(f, 'utf8')))
    expect(updates.length, 'nenhum `.update(` encontrado — o detector parou de casar').toBeGreaterThan(20)
    expect(
      updates.filter((u) => u.guardas.length > 0).length,
      'nenhum update com guarda no where — o detector de guarda parou de casar, e aí a lista de ' +
        'ofensores fica vazia para sempre',
    ).toBeGreaterThan(3)
  })
})

describe('update com guarda no where confere quantas linhas mudaram', () => {
  it('nenhum fora da lista justificada', () => {
    const ofensores = arquivos(RAIZ)
      .flatMap((f) => updatesDe(readFileSync(f, 'utf8')).map((u) => ({ ...u, arquivo: f })))
      .filter((u) => u.guardas.length > 0 && !u.confere)
      .filter((u) => !DISPENSADAS.some((d) => d.arquivo === u.arquivo && u.guardas.includes(d.guarda)))
      .map((u) => `${u.arquivo} [guarda: ${u.guardas.join(', ')}]`)

    expect(
      ofensores,
      'estes `update` têm guarda no `where` e não conferem linhas afetadas. No supabase-js isso ' +
        'devolve `error: null` com zero linhas — sucesso falso. Se for inofensivo, some à lista ' +
        'DISPENSADAS deste arquivo com o motivo escrito.',
    ).toEqual([])
  })

  it('toda dispensa tem motivo escrito, e não só um caminho', () => {
    for (const d of DISPENSADAS) {
      expect(d.porque.length, `${d.arquivo} está dispensado sem motivo`).toBeGreaterThan(40)
    }
  })

  it('e nenhuma dispensa aponta para arquivo que não existe mais', () => {
    const todos = new Set(arquivos(RAIZ))
    const fantasmas = DISPENSADAS.filter((d) => !todos.has(d.arquivo)).map((d) => d.arquivo)
    expect(fantasmas, 'dispensa apontando para arquivo inexistente — a lista envelheceu').toEqual([])
  })
})
