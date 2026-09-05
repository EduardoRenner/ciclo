import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

import { limparChavesDeIdempotencia } from '@/server/http/idempotency'

/**
 * Achado da auditoria de 2026-08-28. `idempotency_keys` era a única tabela do projeto com dado
 * pessoal e **nenhuma limpeza por idade** — `rate_limits` já tinha a sua, dentro do
 * `consumir_rate_limit`.
 *
 * Duas faxinas, e a primeira conserta comportamento, não só higiene:
 *
 * 1. **Reserva órfã.** `comIdempotencia` reserva a chave, executa e grava a resposta. Se o
 *    processo morre no meio, a linha fica com `response_status` nulo — e toda repetição com
 *    aquela chave recebe `429` "tente de novo em instantes", para sempre. A fila offline reenvia
 *    com a MESMA chave (`mutacao.id`), então a mutação que caiu nessa janela nunca mais entra.
 * 2. **Retenção.** `response_body` guarda o corpo da resposta, e o corpo de `POST /clients` é a
 *    cliente — nome, telefone, CPF, endereço. Guardar isso para sempre para deduplicar um reenvio
 *    que não virá contraria a necessidade (LGPD art. 6).
 */

type Chamada = { tabela: string; verbo: 'select' | 'delete'; filtros: string[]; chaves?: string[] }

/** Cliente encenado: registra os filtros exatos, que é o que precisa estar certo. */
function bancoFalso(porConsulta: string[][]) {
  const chamadas: Chamada[] = []
  let rodada = 0

  const construtor = (tabela: string) => ({
    select: () => {
      const filtros: string[] = []
      const q = {
        is: (coluna: string, valor: unknown) => {
          filtros.push(`is:${coluna}=${String(valor)}`)
          return q
        },
        lt: (coluna: string, valor: string) => {
          filtros.push(`lt:${coluna}=${valor}`)
          return q
        },
        limit: (n: number) => {
          filtros.push(`limit:${n}`)
          const linhas = (porConsulta[rodada] ?? []).map((key) => ({ key }))
          rodada++
          chamadas.push({ tabela, verbo: 'select', filtros })
          return Promise.resolve({ data: linhas, error: null })
        },
      }
      return q
    },
    delete: () => ({
      in: (_coluna: string, chaves: string[]) => {
        chamadas.push({ tabela, verbo: 'delete', filtros: [], chaves })
        return Promise.resolve({ error: null })
      },
    }),
  })

  return { db: { from: construtor } as never, chamadas }
}

const AGORA = new Date('2026-08-28T12:00:00.000Z')

describe('limparChavesDeIdempotencia', () => {
  it('apaga a reserva órfã e a chave vencida, e devolve as duas contagens', async () => {
    const { db, chamadas } = bancoFalso([['orfa-1', 'orfa-2'], ['velha-1']])

    const r = await limparChavesDeIdempotencia(db, AGORA)

    expect(r).toEqual({ orfas: 2, vencidas: 1 })
    const apagados = chamadas.filter((c) => c.verbo === 'delete')
    expect(apagados).toHaveLength(2)
    expect(apagados[0]!.chaves).toEqual(['orfa-1', 'orfa-2'])
    expect(apagados[1]!.chaves).toEqual(['velha-1'])
  })

  it('a faxina de órfãs filtra por resposta ausente e por uma hora, não por trinta dias', async () => {
    // O corte errado aqui é o defeito de verdade: muito curto e ela apaga reserva ainda em voo;
    // muito longo e a chave presa continua devolvendo 429 para o reenvio da fila offline.
    const { db, chamadas } = bancoFalso([[], []])
    await limparChavesDeIdempotencia(db, AGORA)
    const orfas = chamadas.filter((c) => c.verbo === 'select')[0]!
    expect(orfas.filtros).toContain('is:response_status=null')
    expect(orfas.filtros).toContain('lt:created_at=2026-08-28T11:00:00.000Z')
  })

  it('a faxina de retenção olha só a idade — chave respondida também vence', async () => {
    const { db, chamadas } = bancoFalso([[], []])
    await limparChavesDeIdempotencia(db, AGORA)
    const vencidas = chamadas.filter((c) => c.verbo === 'select')[1]!
    expect(vencidas.filtros).toContain('lt:created_at=2026-07-29T12:00:00.000Z')
    expect(
      vencidas.filtros.some((f) => f.startsWith('is:response_status')),
      'a retenção não pode olhar `response_status`: chave respondida também precisa vencer',
    ).toBe(false)
  })

  it('toda passada tem teto — limpeza nunca vira varredura cara escondida', async () => {
    const { db, chamadas } = bancoFalso([[], []])
    await limparChavesDeIdempotencia(db, AGORA)
    for (const c of chamadas.filter((x) => x.verbo === 'select')) {
      expect(c.filtros.some((f) => f.startsWith('limit:')), `consulta sem teto: ${c.filtros.join(', ')}`).toBe(true)
    }
  })

  it('nada para apagar não vira DELETE nenhum', async () => {
    const { db, chamadas } = bancoFalso([[], []])
    const r = await limparChavesDeIdempotencia(db, AGORA)
    expect(r).toEqual({ orfas: 0, vencidas: 0 })
    expect(chamadas.filter((c) => c.verbo === 'delete')).toEqual([])
  })
})

describe('a faxina roda de verdade — está pendurada na única rota que roda sozinha', () => {
  const ROTA = 'src/app/api/cron/recompute-cycles/route.ts'
  const fonte = semComentarios(readFileSync(ROTA, 'utf8'))

  it('a leitura não voltou vazia', () => {
    expect(fonte.length, `${ROTA} veio vazio`).toBeGreaterThan(400)
  })

  it('a rota CHAMA a faxina — o nome solto no import não conta', () => {
    expect(
      fonte.includes('limparChavesDeIdempotencia(svc'),
      'a faxina saiu do recompute-cycles. Não existe outra rota agendada onde ela caia: `segments` ' +
        'é a única outra, e as demais só existem no workflow_dispatch. Limpeza que ninguém dispara ' +
        'é limpeza que não existe.',
    ).toBe(true)
  })

  it('a faxina fica FORA do `if (processados > 0)`', () => {
    // Chave órfã prende reenvio da fila offline a qualquer hora, não só na madrugada dos tenants.
    const guarda = fonte.indexOf('if (processados > 0)')
    const faxina = fonte.indexOf('limparChavesDeIdempotencia(svc')
    expect(guarda, 'a guarda do heartbeat sumiu — este teste precisa ser revisto junto').toBeGreaterThan(-1)
    expect(faxina, 'não achei a chamada da faxina').toBeGreaterThan(guarda)
  })

  it('o resultado aparece na resposta — número que ninguém vê é número que ninguém confere', () => {
    expect(fonte).toContain('chavesOrfas')
    expect(fonte).toContain('chavesVencidas')
  })
})
