import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { abrirDekCifrada, rewrapDek } from '@/server/crypto/kek'
import { decryptVault, encryptVault, limparCacheDek } from '@/server/crypto/vault'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de vault precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantA: string
let tenantB: string
const tenants: string[] = []
const usuarios: string[] = []

async function criarTenant(sufixo: string) {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `vault-${sufixo}-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: `Dona ${sufixo}` },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: `Salão do Cofre ${sufixo}`,
    vertical: 'nails',
    slug: `vault-${sufixo}-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenants.push(tenant.id)
  return tenant.id
}

beforeAll(async () => {
  ;[tenantA, tenantB] = await Promise.all([criarTenant('a'), criarTenant('b')])
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('encryptVault / decryptVault', () => {
  it(
    'ida e volta preserva o objeto original',
    async () => {
      limparCacheDek()
      const original = { alergia: 'látex', observacao: 'pele sensível' }

      const registro = await encryptVault(svc, tenantA, original)
      const de_volta = await decryptVault(svc, tenantA, registro)

      expect(de_volta).toEqual(original)
    },
    30_000,
  )

  it(
    'o ciphertext gravado é ilegível — não contém o texto original em claro',
    async () => {
      limparCacheDek()
      const registro = await encryptVault(svc, tenantA, { nota: 'informação sensível de saúde' })

      expect(registro.ciphertext.toString('utf8')).not.toContain('informação sensível')
      expect(registro.ciphertext.toString('utf8')).not.toContain('saúde')
    },
    30_000,
  )

  it(
    'a DEK do tenant B não abre o que o tenant A cifrou',
    async () => {
      limparCacheDek()
      const registro = await encryptVault(svc, tenantA, { segredo: 'só do tenant A' })

      await expect(decryptVault(svc, tenantB, registro)).rejects.toThrow()
    },
    30_000,
  )

  it(
    'adulterar um byte do ciphertext derruba a tag do GCM — nunca devolve lixo em silêncio',
    async () => {
      limparCacheDek()
      const registro = await encryptVault(svc, tenantA, { dado: 'original' })
      registro.ciphertext[0] = registro.ciphertext[0]! ^ 0xff

      await expect(decryptVault(svc, tenantA, registro)).rejects.toThrow()
    },
    30_000,
  )

  it(
    're-embrulhar a DEK não quebra registros já cifrados (§8: a DEK não muda, só a KEK que a protege)',
    async () => {
      limparCacheDek()
      const registro = await encryptVault(svc, tenantA, { antes_da_rotacao: true })

      /*
       * O que este teste prova é METADE da rotação: que trocar `dek_wrapped` mantém legível tudo
       * o que já estava cifrado — porque a DEK em si não muda. É a parte que dispensa recifrar
       * `health_records` inteiro.
       *
       * O que ele NÃO prova, e antes fingia provar: até a auditoria de 2026-08-23 (achado S8) o
       * título dizia "rotação de KEK" e o comentário dizia "o mesmo que a KEK anual faria" — mas
       * o re-embrulho usa a MESMA `VAULT_KEK` do ambiente, então nenhuma chave é trocada aqui.
       * O teste passava verde enquanto a rotação de verdade era impossível: `abrirDekCifrada` só
       * conhecia a chave atual, e trocá-la deixava todo cofre ilegível para sempre.
       *
       * A outra metade — abrir material embrulhado por uma KEK ANTERIOR — está em
       * `tests/unit/server/kek-rotacao.test.ts`, que injeta as chaves em vez de mutar
       * `process.env` (arquivos do Vitest compartilham o env por referência).
       */
      const { data: linha } = await svc.from('tenant_keys').select('dek_wrapped').eq('tenant_id', tenantA).single()
      const dekEmClaro = abrirDekCifrada(linha!.dek_wrapped)
      const { wrapped, keyVersion } = rewrapDek(dekEmClaro)

      await svc.from('tenant_keys').update({ dek_wrapped: wrapped, key_version: keyVersion, rotated_at: new Date().toISOString() }).eq('tenant_id', tenantA)
      limparCacheDek() // força reler o tenant_keys já rotacionado

      const de_volta = await decryptVault(svc, tenantA, registro)
      expect(de_volta).toEqual({ antes_da_rotacao: true })
    },
    30_000,
  )

  it(
    'com o cache quente, decryptVault não consulta tenant_keys de novo',
    async () => {
      limparCacheDek()
      const registro = await encryptVault(svc, tenantA, { valor: 'aquece o cache' }) // 1ª leitura de tenant_keys, cache fica quente

      let chamadasATenantKeys = 0
      const espiao = new Proxy(svc, {
        get(alvo, prop, receptor) {
          const original = Reflect.get(alvo, prop, receptor) as unknown
          if (prop !== 'from') return original
          return (tabela: string) => {
            if (tabela === 'tenant_keys') chamadasATenantKeys++
            return (original as typeof svc.from)(tabela as never)
          }
        },
      })

      await decryptVault(espiao as typeof svc, tenantA, registro)
      expect(chamadasATenantKeys).toBe(0)
    },
    30_000,
  )
})
