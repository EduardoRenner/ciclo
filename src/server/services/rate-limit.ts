import { withNovoTenant } from '@/server/db/with-tenant'

/**
 * Contador de janela fixa, com três implementações em ordem de preferência:
 * **Upstash → Postgres → memória do processo**.
 *
 * ## Por que a ordem é essa (auditoria de segurança, achado S4)
 *
 * A especificação (G99) mandava usar Upstash Redis — "a única exceção ao sem Redis". O código
 * fazia isso e, sem as variáveis, caía num `Map` do processo. O comentário antigo já era honesto
 * sobre a consequência ("não protege um deploy serverless com várias instâncias"), mas ninguém
 * tinha ido conferir se o Upstash existia: `vercel env ls production` em 2026-08-23 mostrou que
 * **não existe**. Ou seja, o limitador de produção era por instância viva — o "5/min por IP" do
 * agendamento público valia por instância, não por IP.
 *
 * O Postgres entrou no meio porque já é compartilhado por todas as instâncias, já está
 * provisionado e já está no caminho de toda requisição. Upstash exigiria criar conta em terceiro,
 * a mesma fila em que Asaas e WhatsApp estão parados. Se um dia for provisionado, ele volta a ter
 * precedência sem mudar mais nada aqui.
 *
 * ## `somenteMemoria`: onde o balde compartilhado NÃO vale o preço
 *
 * O teto global de 120/min do `rota()` roda em **toda** requisição da API. Levá-lo ao banco
 * custaria uma ida de rede a mais no caminho feliz de tudo, para reforçar uma rede grossa cujo
 * trabalho é conter laço maluco batendo numa instância — não é ela que segura o ataque do S4.
 * Os limites finos (agendamento público, disponibilidade) são os que precisam contar certo, e
 * esses vão ao banco. É troca consciente, não esquecimento.
 */

type Resultado = { permitido: boolean; restante: number }
type Opcoes = {
  limite: number
  janelaSegundos: number
  /** Fica no processo de propósito — ver o bloco acima. Só o teto global usa isto. */
  somenteMemoria?: boolean
}

type Janela = { contagem: number; expiraEm: number }
const memoria = new Map<string, Janela>()

function limitarEmMemoria(chave: string, limite: number, janelaSegundos: number): Resultado {
  const agora = Date.now()
  const atual = memoria.get(chave)

  if (!atual || atual.expiraEm <= agora) {
    memoria.set(chave, { contagem: 1, expiraEm: agora + janelaSegundos * 1000 })
    return { permitido: true, restante: limite - 1 }
  }

  atual.contagem++
  return { permitido: atual.contagem <= limite, restante: Math.max(0, limite - atual.contagem) }
}

/**
 * `consumir_rate_limit` (migration 0035) incrementa e decide num comando só —
 * `insert ... on conflict do update` é atômico, e o Postgres serializa quem chega junto.
 * Ler-e-depois-escrever aqui teria a corrida do achado S11 dentro do mecanismo cujo trabalho
 * é justamente contar certo.
 */
async function limitarNoPostgres(chave: string, limite: number, janelaSegundos: number): Promise<Resultado> {
  return withNovoTenant(async (svc) => {
    const { data, error } = await svc.rpc('consumir_rate_limit', {
      p_key: chave,
      p_limite: limite,
      p_janela_segundos: janelaSegundos,
    })
    if (error) throw error

    const linha = Array.isArray(data) ? data[0] : data
    if (!linha) throw new Error('consumir_rate_limit não devolveu linha')
    return { permitido: linha.permitido, restante: linha.restante }
  })
}

async function limitarComUpstash(
  chave: string,
  limite: number,
  janelaSegundos: number,
  url: string,
  token: string,
): Promise<Resultado> {
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

export async function limitador(chave: string, opcoes: Opcoes): Promise<Resultado> {
  const { limite, janelaSegundos, somenteMemoria } = opcoes

  if (somenteMemoria) return limitarEmMemoria(chave, limite, janelaSegundos)

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) {
    try {
      return await limitarComUpstash(chave, limite, janelaSegundos, url, token)
    } catch (erro) {
      console.warn(JSON.stringify({ level: 'warn', event: 'upstash_indisponivel' }), erro)
      // Cai para o Postgres, não direto para a memória: ainda é compartilhado.
    }
  }

  try {
    return await limitarNoPostgres(chave, limite, janelaSegundos)
  } catch (erro) {
    // Banco fora do ar não pode virar "aceita tudo sem limite", mas também não pode derrubar o
    // agendamento público inteiro — e, se o Postgres caiu, a rota atrás deste limitador já vai
    // falhar de qualquer jeito. A memória local ainda segura um script simples.
    console.warn(JSON.stringify({ level: 'warn', event: 'rate_limit_banco_indisponivel' }), erro)
    return limitarEmMemoria(chave, limite, janelaSegundos)
  }
}
