/**
 * G99: "use Upstash Redis só para isso — é a única exceção ao sem Redis".
 * Sem `UPSTASH_REDIS_REST_URL`/`TOKEN` provisionados, o limitador cai para um
 * contador em memória do próprio processo — funciona para provar o
 * comportamento (e é o que os testes exercitam), mas **não** protege um
 * deploy serverless com várias instâncias, que não compartilham memória.
 * Ligar o Upstash de verdade é um passo de infraestrutura, não de código.
 */

type Janela = { contagem: number; expiraEm: number }
const memoria = new Map<string, Janela>()

function limitarEmMemoria(chave: string, limite: number, janelaSegundos: number): { permitido: boolean; restante: number } {
  const agora = Date.now()
  const atual = memoria.get(chave)

  if (!atual || atual.expiraEm <= agora) {
    memoria.set(chave, { contagem: 1, expiraEm: agora + janelaSegundos * 1000 })
    return { permitido: true, restante: limite - 1 }
  }

  atual.contagem++
  return { permitido: atual.contagem <= limite, restante: Math.max(0, limite - atual.contagem) }
}

async function limitarComUpstash(
  chave: string,
  limite: number,
  janelaSegundos: number,
  url: string,
  token: string,
): Promise<{ permitido: boolean; restante: number }> {
  // INCR + EXPIRE (só na primeira vez) via a API REST do Upstash — janela fixa,
  // simples o bastante para o que G99 pede.
  const incr = await fetch(`${url}/incr/${encodeURIComponent(chave)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const { result: contagem } = (await incr.json()) as { result: number }

  if (contagem === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(chave)}/${janelaSegundos}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  return { permitido: contagem <= limite, restante: Math.max(0, limite - contagem) }
}

export async function limitador(
  chave: string,
  opcoes: { limite: number; janelaSegundos: number },
): Promise<{ permitido: boolean; restante: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) {
    try {
      return await limitarComUpstash(chave, opcoes.limite, opcoes.janelaSegundos, url, token)
    } catch (erro) {
      // Upstash fora do ar não pode virar "aceita tudo sem limite" — mas
      // também não pode derrubar o booking público inteiro. Cai para a
      // memória local, que ainda segura um script simples.
      console.warn(JSON.stringify({ level: 'warn', event: 'upstash_indisponivel' }), erro)
      return limitarEmMemoria(chave, opcoes.limite, opcoes.janelaSegundos)
    }
  }

  return limitarEmMemoria(chave, opcoes.limite, opcoes.janelaSegundos)
}
