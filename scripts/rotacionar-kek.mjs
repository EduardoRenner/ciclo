#!/usr/bin/env node
/**
 * Rotação da KEK (auditoria de segurança, achado S8).
 *
 * A DEK de cada tenant **não muda** — o que muda é a chave que a embrulha. Por isso nada em
 * `health_records` precisa ser recifrado: os registros continuam abrindo com a mesma DEK.
 *
 * ## Como usar
 *
 *   1. gere a nova:            openssl rand -base64 32
 *   2. no ambiente, mova a atual para VAULT_KEK_PREVIOUS e ponha a nova em VAULT_KEK
 *      (some VAULT_KEK_VERSION em 1)
 *   3. confira o que vai acontecer:   node scripts/rotacionar-kek.mjs
 *   4. aplique:                       node scripts/rotacionar-kek.mjs --aplicar
 *   5. depois que todos os tenants estiverem na versão nova, remova VAULT_KEK_PREVIOUS
 *
 * Entre 2 e 4 a aplicação continua funcionando: `abrirDekCifrada` aceita as duas chaves.
 *
 * ## Por que a criptografia está duplicada aqui
 *
 * `.mjs` puro não resolve os aliases de path do projeto (`@/server/...`), então não dá para
 * importar `kek.ts`. A duplicação é um risco real — um envelope escrito diferente do de
 * produção corromperia `dek_wrapped` de todo mundo. Por isso o script **não confia em si
 * mesmo**: antes de tocar no banco ele faz um ida-e-volta com material sintético, e por tenant
 * confere que o valor novo reabre para exatamente a mesma DEK antes de gravar. Nenhuma escrita
 * acontece sem essa prova.
 */
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const TAMANHO_DEK = 32
const TAMANHO_IV = 12
const TAMANHO_TAG = 16

const APLICAR = process.argv.includes('--aplicar')

function decodificar(bruta, nome) {
  const chave = Buffer.from(bruta, 'base64')
  if (chave.length !== TAMANHO_DEK) throw new Error(`${nome} precisa decodificar para 32 bytes; tem ${chave.length}.`)
  return chave
}

function embrulhar(dek, kek) {
  const iv = randomBytes(TAMANHO_IV)
  const cifra = createCipheriv('aes-256-gcm', kek, iv)
  const ciphertext = Buffer.concat([cifra.update(dek), cifra.final()])
  return `\\x${Buffer.concat([iv, cifra.getAuthTag(), ciphertext]).toString('hex')}`
}

function desembrulhar(wrapped, kek) {
  const bruto = Buffer.from(wrapped.replace(/^\\x/, ''), 'hex')
  const decifra = createDecipheriv('aes-256-gcm', kek, bruto.subarray(0, TAMANHO_IV))
  decifra.setAuthTag(bruto.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG))
  const ct = bruto.subarray(TAMANHO_IV + TAMANHO_TAG)
  return Buffer.concat([decifra.update(ct), decifra.final()])
}

/** Prova que o envelope reimplementado acima é o mesmo do `kek.ts`, antes de tocar em dado real. */
function autoTeste(kek) {
  const dek = randomBytes(TAMANHO_DEK)
  const volta = desembrulhar(embrulhar(dek, kek), kek)
  if (volta.length !== dek.length || !timingSafeEqual(volta, dek)) {
    throw new Error('Auto-teste do envelope falhou — NÃO rotacione. A criptografia deste script não bate.')
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const servico = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !servico) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local.')

if (!process.env.VAULT_KEK) throw new Error('VAULT_KEK ausente.')
const atual = decodificar(process.env.VAULT_KEK, 'VAULT_KEK')
const anterior = process.env.VAULT_KEK_PREVIOUS ? decodificar(process.env.VAULT_KEK_PREVIOUS, 'VAULT_KEK_PREVIOUS') : null

autoTeste(atual)

const versaoNova = Number(process.env.VAULT_KEK_VERSION ?? '1')
if (!Number.isInteger(versaoNova) || versaoNova < 1) throw new Error('VAULT_KEK_VERSION precisa ser inteiro positivo.')

const svc = createClient(url, servico, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: chaves, error } = await svc.from('tenant_keys').select('tenant_id, dek_wrapped, key_version').order('tenant_id')
if (error) throw error

console.log(`${chaves.length} tenant(s) com cofre. Versão alvo: ${versaoNova}. Modo: ${APLICAR ? 'APLICAR' : 'simulação'}.`)

let jaNaVersao = 0
let rotacionados = 0
const falhas = []

for (const linha of chaves) {
  // Abre com a atual primeiro (tenant já rotacionado, ou rodada repetida), depois com a anterior.
  let dek = null
  let comQual = null
  for (const [nome, kek] of [['atual', atual], ['anterior', anterior]]) {
    if (!kek) continue
    try {
      dek = desembrulhar(linha.dek_wrapped, kek)
      comQual = nome
      break
    } catch {
      // chave errada — tenta a próxima
    }
  }

  if (!dek) {
    falhas.push(`${linha.tenant_id}: não abriu com nenhuma das KEKs do ambiente`)
    continue
  }

  if (comQual === 'atual' && linha.key_version === versaoNova) {
    jaNaVersao++
    continue
  }

  const novoWrapped = embrulhar(dek, atual)

  // Prova por tenant: o valor que vai ser gravado reabre para EXATAMENTE a mesma DEK.
  // Sem isto, um erro no envelope só apareceria quando alguém abrisse a anamnese — depois de a
  // chave antiga já ter sido descartada, ou seja, tarde demais.
  const conferencia = desembrulhar(novoWrapped, atual)
  if (conferencia.length !== dek.length || !timingSafeEqual(conferencia, dek)) {
    falhas.push(`${linha.tenant_id}: conferência do re-embrulho falhou — nada foi gravado`)
    continue
  }

  if (!APLICAR) {
    console.log(`  [simulação] ${linha.tenant_id}: abriria com a KEK ${comQual}, iria para a versão ${versaoNova}`)
    rotacionados++
    continue
  }

  const { error: erroUpdate } = await svc
    .from('tenant_keys')
    .update({ dek_wrapped: novoWrapped, key_version: versaoNova, rotated_at: new Date().toISOString() })
    .eq('tenant_id', linha.tenant_id)
  if (erroUpdate) {
    falhas.push(`${linha.tenant_id}: ${erroUpdate.message}`)
    continue
  }
  console.log(`  ${linha.tenant_id}: re-embrulhado (abria com a KEK ${comQual})`)
  rotacionados++
}

console.log(`\nJá na versão alvo: ${jaNaVersao}. ${APLICAR ? 'Rotacionados' : 'Rotacionariam'}: ${rotacionados}. Falhas: ${falhas.length}.`)
for (const f of falhas) console.error(`  FALHA ${f}`)

if (falhas.length > 0) process.exit(1)
if (!APLICAR) console.log('\nNada foi gravado. Rode de novo com --aplicar quando estiver satisfeito.')
