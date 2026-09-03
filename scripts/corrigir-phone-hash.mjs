/**
 * Preenche `clients.phone_hash` onde ele está nulo mas há `phone_e164`.
 *
 *   node scripts/corrigir-phone-hash.mjs              # todos os tenants
 *   node scripts/corrigir-phone-hash.mjs dom-rocha    # só um
 *
 * ── Por que este script existe ────────────────────────────────────────────────────────────────
 *
 * Toda busca de cliente por telefone no produto passa pelo HASH, nunca pelo número. Com o hash
 * nulo, nada quebra na tela — o painel lista, a ficha abre, o gráfico soma — mas:
 *
 *   · `reconhecimento.ts` nunca reconhece ninguém: a funcionalidade parece não existir;
 *   · `agendamentos.ts` procura pelo hash, não acha, tenta INSERT e bate na `clients_unique_phone`
 *     pelo `phone_e164` → **500 na cara de quem estava agendando**, e só para quem JÁ é cliente.
 *
 * É a definição de falha silenciosa: o defeito só aparece na hora exata em que o produto deveria
 * brilhar. Já apareceu com 132 clientes num seed antigo; reapareceu no `dom-rocha`, que é a conta
 * que o site usa como exemplo.
 *
 * O sal nunca é impresso nem gravado — sai de `PHONE_HASH_SALT` no ambiente e morre no processo.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
const URL_SUPABASE = process.env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
const SAL = process.env.PHONE_HASH_SALT ?? env.PHONE_HASH_SALT
if (!SAL) throw new Error('PHONE_HASH_SALT ausente — sem ele o hash sairia diferente do que o app calcula.')

const svc = createClient(URL_SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
console.log(`escrevendo em ${new URL(URL_SUPABASE).host}`)

/** Idêntico a `hashTelefone` em `src/server/services/telefone.ts`. Divergir aqui é pior que não rodar. */
const hashTelefone = (e164) => createHash('sha256').update(e164 + SAL, 'utf8').digest('hex')

const alvo = process.argv.slice(2)
let consultaTenants = svc.from('tenants').select('id, slug')
if (alvo.length) consultaTenants = consultaTenants.in('slug', alvo)
const { data: tenants, error: et } = await consultaTenants
if (et) throw et

let totalCorrigidos = 0
let totalConflitos = 0

for (const t of tenants) {
  const { data: semHash, error } = await svc
    .from('clients')
    .select('id, phone_e164')
    .eq('tenant_id', t.id)
    .is('phone_hash', null)
    .not('phone_e164', 'is', null)
  if (error) throw error
  if (!semHash.length) continue

  let corrigidos = 0
  let conflitos = 0
  for (const c of semHash) {
    const { error: e } = await svc.from('clients').update({ phone_hash: hashTelefone(c.phone_e164) }).eq('id', c.id).eq('tenant_id', t.id)
    if (e) {
      // 23505 = dois cadastros com o MESMO telefone no mesmo tenant. Não é erro deste script:
      // é duplicata pré-existente que o hash agora denuncia. Deixa nulo e conta — mesclar
      // cadastro é decisão de quem atende, não de um script.
      if (e.code === '23505') conflitos++
      else throw e
    } else corrigidos++
  }
  totalCorrigidos += corrigidos
  totalConflitos += conflitos
  console.log(`${t.slug.padEnd(20)} ${corrigidos} corrigidos${conflitos ? `, ${conflitos} com telefone duplicado (deixados nulos)` : ''}`)
}

// ── Conferência: ninguém pode sobrar com telefone e sem hash ─────────────────────────────────
const { count: restantes } = await svc
  .from('clients')
  .select('*', { count: 'exact', head: true })
  .is('phone_hash', null)
  .not('phone_e164', 'is', null)

console.log(`\n${totalCorrigidos} hashes gravados`)
if (restantes && restantes > totalConflitos) {
  console.error(`✗ ainda restam ${restantes} clientes com telefone e sem hash (${totalConflitos} são duplicatas conhecidas)`)
  process.exit(1)
}
console.log(restantes ? `✓ só restam os ${restantes} de telefone duplicado, que precisam de decisão humana` : '✓ nenhum cliente com telefone ficou sem hash')
