import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { abrirDekCifrada } from '@/server/crypto/kek'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const TAMANHO_IV = 12
const CACHE_MS = 5 * 60 * 1000 // §8: "cache de no máximo 5 minutos"

type EntradaCache = { dek: Buffer; expiresAt: number }

/**
 * A DEK em claro vive só em memória (§8), nunca em disco nem em coluna — este
 * `Map` é exatamente esse "só em memória", por tenant, com expiração. Não é
 * um LRU: o processo serverless recicla sozinho, e 5 minutos é curto o
 * bastante para não precisar de limite de tamanho.
 */
const cacheDek = new Map<string, EntradaCache>()

/** Só para teste: força o próximo `dekDoTenant` a ir ao banco de novo. */
export function limparCacheDek(): void {
  cacheDek.clear()
}

async function dekDoTenant(db: Cliente, tenantId: string): Promise<Buffer> {
  const cache = cacheDek.get(tenantId)
  if (cache && cache.expiresAt > Date.now()) return cache.dek

  const { data, error } = await db.from('tenant_keys').select('dek_wrapped').eq('tenant_id', tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('VAULT_LOCKED', { message: 'Este estabelecimento ainda não tem cofre configurado.' })

  const dek = abrirDekCifrada(data.dek_wrapped)
  cacheDek.set(tenantId, { dek, expiresAt: Date.now() + CACHE_MS })
  return dek
}

export type RegistroCifrado = { ciphertext: Buffer; iv: Buffer; tag: Buffer; keyVersion: number }

/**
 * §8: `encryptVault(tenantId, plaintextJson) -> {ciphertext, iv, tag, keyVersion}`.
 * `keyVersion` gravado é o de `tenant_keys` no momento da escrita — não é
 * usado para decifrar (a DEK em si nunca muda de versão, só a KEK que a
 * embrulha rotaciona, §8), fica só como trilha de auditoria de qual rotação
 * de KEK estava vigente quando o registro nasceu.
 */
export async function encryptVault(db: Cliente, tenantId: string, plaintextJson: unknown): Promise<RegistroCifrado> {
  const [dek, { data: chave, error }] = await Promise.all([
    dekDoTenant(db, tenantId),
    db.from('tenant_keys').select('key_version').eq('tenant_id', tenantId).maybeSingle(),
  ])
  if (error) throw new AppError('INTERNAL', { cause: error })

  const iv = randomBytes(TAMANHO_IV)
  const cifra = createCipheriv('aes-256-gcm', dek, iv)
  const ciphertext = Buffer.concat([cifra.update(JSON.stringify(plaintextJson), 'utf8'), cifra.final()])
  const tag = cifra.getAuthTag()

  return { ciphertext, iv, tag, keyVersion: chave?.key_version ?? 1 }
}

/** §8: `decryptVault(tenantId, record) -> objeto`. Tag adulterada ou DEK errada estoura, nunca devolve lixo em silêncio. */
export async function decryptVault(db: Cliente, tenantId: string, registro: Pick<RegistroCifrado, 'ciphertext' | 'iv' | 'tag'>): Promise<unknown> {
  const dek = await dekDoTenant(db, tenantId)

  const decifra = createDecipheriv('aes-256-gcm', dek, registro.iv)
  decifra.setAuthTag(registro.tag)
  const texto = Buffer.concat([decifra.update(registro.ciphertext), decifra.final()]).toString('utf8')

  return JSON.parse(texto) as unknown
}
