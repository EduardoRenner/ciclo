/**
 * `fetch` com `Idempotency-Key` por TENTATIVA (APR-007, achados B-07 e C-12).
 *
 * A chave nascia dentro do handler, a cada toque: dois toques em "Adicionar item" que escapavam da
 * trava do botão viravam dois pedidos e gravavam dois itens; com rede lenta, o reenvio de "Marcar"
 * dava 409 para o próprio horário. Aqui a chave vale para uma tentativa (mesmo método, endereço e
 * corpo):
 *
 * - nasce no 1º envio e é REUSADA enquanto a tentativa não termina (duplo toque, reenvio depois de
 *   a rede cair, 5xx, 429): o servidor devolve a mesma resposta em vez de gravar de novo;
 * - MORRE no sucesso e em erro 4xx: dois itens iguais lançados de propósito, um depois do outro,
 *   são dois pedidos (R-07). Deduplicar por conteúdo esconderia a segunda venda.
 */
const tentativas = new Map<string, string>()

function identidade(url: string, init: RequestInit): string {
  return `${(init.method ?? 'GET').toUpperCase()} ${url}\n${typeof init.body === 'string' ? init.body : ''}`
}

/** Erro que pede nova tentativa com a MESMA chave: a escrita pode ou não ter acontecido. */
function tentativaContinua(status: number): boolean {
  return status >= 500 || status === 429
}

/**
 * O 2º toque que chega com o 1º ainda gravando recebe 429 + `Retry-After` (a chave está reservada e
 * sem resposta). Esperar e repetir devolve a resposta do 1º, em vez de mostrar erro de um pedido que
 * deu certo.
 */
const ESPERAS_EM_VOO = 3
const ESPERA_MAXIMA_MS = 5000

function esperaPedida(resposta: Response): number | null {
  if (resposta.status !== 429) return null
  const segundos = Number(resposta.headers.get('retry-after'))
  if (!Number.isFinite(segundos) || segundos <= 0) return null
  return Math.min(segundos * 1000, ESPERA_MAXIMA_MS)
}

export async function fetchComTentativa(url: string, init: RequestInit = {}): Promise<Response> {
  const id = identidade(url, init)
  let chave = tentativas.get(id)
  if (!chave) {
    chave = crypto.randomUUID()
    tentativas.set(id, chave)
  }
  const headers = new Headers(init.headers)
  headers.set('idempotency-key', chave)

  // Falha de rede propaga: a tentativa continua viva para o reenvio usar a mesma chave.
  let resposta = await fetch(url, { ...init, headers })
  for (let i = 0; i < ESPERAS_EM_VOO; i++) {
    const espera = esperaPedida(resposta)
    if (espera === null) break
    await new Promise((ok) => setTimeout(ok, espera))
    resposta = await fetch(url, { ...init, headers })
  }
  // Só encerra a PRÓPRIA tentativa: outra pode ter nascido para o mesmo corpo enquanto esta esperava.
  if (!tentativaContinua(resposta.status) && tentativas.get(id) === chave) tentativas.delete(id)
  return resposta
}

/** Só para teste: quantas tentativas estão em aberto. */
export function tentativasEmAberto(): number {
  return tentativas.size
}
