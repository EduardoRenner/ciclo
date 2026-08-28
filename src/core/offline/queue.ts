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

/**
 * O que fazer com o status que o servidor devolveu para uma mutação da fila.
 *
 * Morava dentro de `enviarMutacao`, no adaptador de browser — que o próprio arquivo declara
 * intestável neste projeto (sem jsdom). Ou seja: a regra que decide entre *reenviar*, *pedir
 * ajuda* e **jogar fora o trabalho da pessoa** era a única parte da fila offline sem teste.
 *
 * Auditoria de 2026-08-28: `401` e `403` caíam no `descarte`. O cenário não é raro — é o mais
 * provável de todos. O tablet do balcão passa a noite sem rede com um agendamento na fila, a
 * sessão vence, a rede volta, o servidor responde `401`, e a mutação é **apagada do IndexedDB**.
 * A pessoa tinha visto "será enviado quando a conexão voltar" e nunca mais ouve falar do assunto.
 * Sessão vencida é recuperável: quem entra de novo drena a fila. Vira `retry`.
 */
export function classificarResposta(status: number): ResultadoEnvio['kind'] {
  if (status >= 200 && status < 300) return 'ok'
  // §4.2.5: conflito vira card, nunca descarte.
  if (status === 409) return 'conflict'
  // Autenticação e autorização são estados do CLIENTE, não veredito sobre a mutação: entrar de
  // novo (ou o gerente devolver a permissão) faz a mesma mutação passar.
  if (status === 401 || status === 403) return 'retry'
  // Excesso de requisições e falha do servidor: tentar de novo é literalmente o que o servidor pede.
  if (status === 429 || status >= 500) return 'retry'
  // O que sobra é recusa definitiva (400, 404, 422, 402...). Sai da fila — e quem chama TEM que
  // contar isso para alguém: apagar trabalho em silêncio é o defeito que a pessoa só descobre
  // quando a cliente aparece para um horário que não existe.
  return 'discard'
}

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
