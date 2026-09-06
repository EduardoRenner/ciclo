import { randomBytes } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * §8 diz que a DEK em claro vive "só em memória, por tenant, **com expiração**", e o comentário do
 * `cacheDek` repete a frase. A expiração impedia o USO — `dekDoTenant` conferia `expiresAt` antes de
 * devolver — mas nada tirava a entrada do `Map`. A DEK de um tenant que parou de ser acessado ficava
 * residente **em claro** até o processo morrer, muito além dos 5 minutos, num cofre de dado de saúde.
 *
 * O arquivo é bem documentado e o texto até responde a pergunta do TAMANHO do cache ("a chave é por
 * tenant, o processo serverless recicla sozinho"). O que ele não discutia era o tempo de VIDA — e era
 * por ali que passava.
 *
 * Estes casos são a diferença entre as duas coisas: a leitura de um tenant tem que soltar a chave
 * vencida **dos outros**, porque a entrada ociosa é justamente a que ninguém volta para expulsar.
 */

const KEK = randomBytes(32).toString('base64')
const T0 = Date.UTC(2026, 0, 15, 12, 0, 0)
const MINUTO = 60 * 1000

type Cofre = typeof import('@/server/crypto/vault')

async function cofreLimpo(): Promise<{ cofre: Cofre; dekEmbrulhada: string }> {
  vi.resetModules()
  process.env.VAULT_KEK = KEK
  const { rewrapDek } = await import('@/server/crypto/kek')
  const cofre = await import('@/server/crypto/vault')
  cofre.limparCacheDek()
  return { cofre, dekEmbrulhada: rewrapDek(randomBytes(32)).wrapped }
}

/** Devolve sempre a mesma DEK embrulhada, para qualquer tenant — o que está sob teste é o cache, não o banco. */
function bancoComDek(dekEmbrulhada: string): Parameters<Cofre['encryptVault']>[0] {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { dek_wrapped: dekEmbrulhada, key_version: 1 }, error: null }),
        }),
      }),
    }),
  } as unknown as Parameters<Cofre['encryptVault']>[0]
}

describe('a DEK em claro não fica residente depois de vencer', () => {
  const kekOriginal = process.env.VAULT_KEK

  afterEach(() => {
    vi.restoreAllMocks()
    if (kekOriginal === undefined) delete process.env.VAULT_KEK
    else process.env.VAULT_KEK = kekOriginal
    vi.resetModules()
  })

  it('ler o tenant B solta a DEK vencida do tenant A', async () => {
    const { cofre, dekEmbrulhada } = await cofreLimpo()
    const db = bancoComDek(dekEmbrulhada)
    const relogio = vi.spyOn(Date, 'now').mockReturnValue(T0)

    await cofre.encryptVault(db, 'tenant-a', { qualquer: 'coisa' })
    expect(cofre.deksEmMemoriaParaTeste()).toBe(1)

    // Seis minutos: a de A venceu (CACHE_MS é 5). Ninguém mais vai pedir a chave de A.
    relogio.mockReturnValue(T0 + 6 * MINUTO)
    await cofre.encryptVault(db, 'tenant-b', { qualquer: 'coisa' })

    // Sem a varredura seriam DUAS — a de B viva e a de A vencida, em claro, sem prazo para sair.
    expect(cofre.deksEmMemoriaParaTeste()).toBe(1)
  })

  it('a chave ainda dentro da janela NÃO é despejada junto', async () => {
    /*
     * A outra direção, e ela é o motivo de o critério ser expiração e não tamanho: soltar entrada
     * viva mandaria toda leitura de volta ao banco + KEK, e o cache dos 5 minutos que o §8 permite
     * deixaria de existir na prática.
     */
    const { cofre, dekEmbrulhada } = await cofreLimpo()
    const db = bancoComDek(dekEmbrulhada)
    const relogio = vi.spyOn(Date, 'now').mockReturnValue(T0)

    await cofre.encryptVault(db, 'tenant-a', { qualquer: 'coisa' })
    relogio.mockReturnValue(T0 + MINUTO)
    await cofre.encryptVault(db, 'tenant-b', { qualquer: 'coisa' })

    expect(cofre.deksEmMemoriaParaTeste()).toBe(2)
  })

  it('a entrada vencida do PRÓPRIO tenant não sobrevive à releitura', async () => {
    // O caso que o `expiresAt > Date.now()` já resolvia para o USO — aqui é para garantir que a
    // varredura não introduziu o oposto: entrada duplicada ou órfã do mesmo tenant.
    const { cofre, dekEmbrulhada } = await cofreLimpo()
    const db = bancoComDek(dekEmbrulhada)
    const relogio = vi.spyOn(Date, 'now').mockReturnValue(T0)

    await cofre.encryptVault(db, 'tenant-a', { qualquer: 'coisa' })
    relogio.mockReturnValue(T0 + 6 * MINUTO)
    await cofre.encryptVault(db, 'tenant-a', { qualquer: 'coisa' })

    expect(cofre.deksEmMemoriaParaTeste()).toBe(1)
  })
})
