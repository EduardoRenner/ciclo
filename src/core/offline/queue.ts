/**
 * TICKET-055, `01-ESPEC §4.2`. Estado puro da fila de mutações offline —
 * sem IndexedDB, sem `fetch` de verdade: recebe um `Enviador` injetado, para
 * dar para testar a ordem/retry/conflito sem depender do browser. O
 * adaptador de verdade (`src/lib/offline/api-client.ts`) é quem liga isso
 * no IndexedDB e no `fetch`.
 */
export type Mutacao = {
  id: string
  method: 'POST' | 'PATCH' | 'DELETE'
  url: string
  body: unknown
  createdAt: string
}

export type ResultadoEnvio = { kind: 'ok' } | { kind: 'conflict' } | { kind: 'discard' } | { kind: 'retry' }

export type Enviador = (mutacao: Mutacao) => Promise<ResultadoEnvio>

export type ResultadoDrenagem = {
  sincronizadas: string[]
  /** §4.2.5: "409 marca o item como precisa da sua atenção. Nunca descarta em silêncio." */
  conflitos: string[]
  descartadas: string[]
  /** Não tentadas nesta passada — a fila parou num erro de rede/5xx antes de chegar nelas. */
  pendentes: string[]
}

/**
 * "Drena a fila EM ORDEM" (§4.2.4) — item por item, mais antigo primeiro.
 * Conflito e descarte são desfechos TERMINAIS daquele item só: não travam os
 * seguintes, que não têm relação nenhuma com o motivo da falha. Já um erro
 * de rede/servidor (`retry`) PARA a drenagem ali — o item e tudo depois dele
 * ficam pendentes para a próxima tentativa, porque uma mutação posterior
 * pode depender causalmente da que acabou de falhar (ex.: PATCH num
 * agendamento que o POST anterior talvez não tenha criado de verdade).
 */
export async function drenarFila(fila: Mutacao[], enviar: Enviador): Promise<ResultadoDrenagem> {
  const ordenada = [...fila].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
  const resultado: ResultadoDrenagem = { sincronizadas: [], conflitos: [], descartadas: [], pendentes: [] }

  for (let i = 0; i < ordenada.length; i++) {
    const mutacao = ordenada[i]!
    const envio = await enviar(mutacao)

    if (envio.kind === 'ok') {
      resultado.sincronizadas.push(mutacao.id)
    } else if (envio.kind === 'conflict') {
      resultado.conflitos.push(mutacao.id)
    } else if (envio.kind === 'discard') {
      resultado.descartadas.push(mutacao.id)
    } else {
      resultado.pendentes.push(...ordenada.slice(i).map((m) => m.id))
      break
    }
  }

  return resultado
}
