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

/** Só para teste: o `Map` é de módulo, e sem isto não dá para ver de fora a entrada que ficou residente. */
export function deksEmMemoriaParaTeste(): number {
  return cacheDek.size
}

/**
 * Solta as entradas vencidas de TODOS os tenants, não só a do que está sendo lido.
 *
 * O comentário de `cacheDek` acima já respondia a pergunta do tamanho — e a resposta é boa, porque
 * a chave é por TENANT (cardinalidade pequena), não por IP. O que ele não respondia é a outra
 * metade da própria frase que ele usa: *"a DEK em claro vive só em memória, por tenant, com
 * expiração"*. A expiração só impedia o USO. Sem varrer, a entrada de um tenant que parou de ser
 * acessado ficava residente com a DEK **em claro** até o processo morrer — muito além dos 5
 * minutos que o `§8` estipula, e este cofre guarda dado de saúde.
 *
 * Varrer no acesso, e não só trocar a entrada do tenant lido, é o que faz diferença: a entrada
 * ociosa é justamente a que ninguém vai tocar de novo para expulsar.
 *
 * **Não zera o Buffer, de propósito.** `dekDoTenant` devolve a MESMA instância que está no cache;
 * `encryptVault` a obtém dentro de um `Promise.all` e usa depois de outro `await`. Sobrescrever os
 * bytes de um Buffer que uma operação em curso ainda segura corromperia a cifragem — trocaria um
 * risco de exposição por um de corromper dado. Soltar a referência já entrega o que importa: a
 * chave vira coletável dentro da janela prometida.
 */
function soltarDeksVencidas(agora: number): void {
  for (const [tenant, entrada] of cacheDek) {
    if (entrada.expiresAt <= agora) cacheDek.delete(tenant)
  }
}

async function dekDoTenant(db: Cliente, tenantId: string): Promise<Buffer> {
  soltarDeksVencidas(Date.now())
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
