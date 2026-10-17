import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { strFromU8, unzipSync } from 'fflate'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { decodificar } from '@/core/ingestao/codificacao'
import { gradeDeTexto } from '@/core/ingestao/delimitado'
import { processarGrade } from '@/core/ingestao/esteira'
import { exportarConta } from '@/server/services/exportacao-conta'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) throw new Error('O teste da exportação da conta precisa das chaves do Supabase local no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/** CNV-009b: a conta inteira num `.zip`, lida sob RLS, paginada, aberta e reimportável. */
const usuarios: string[] = []
const tenants: string[] = []
let dono: SupabaseClient<Database>
let tenantId: string
let outroTenant: string

async function negocio(nome: string) {
  const email = `cnv009-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const u = await svc.auth.admin.createUser({ email, password: senha, email_confirm: true })
  usuarios.push(u.data.user!.id)
  const { tenant } = await executarOnboarding(svc, { userId: u.data.user!.id, businessName: nome, vertical: 'barber', slug: `cnv009-${randomUUID().slice(0, 8)}`, timezone: 'America/Sao_Paulo' })
  tenants.push(tenant.id)
  const db = createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  await db.auth.signInWithPassword({ email, password: senha })
  return { id: tenant.id, db }
}

beforeAll(async () => {
  const a = await negocio('Salão Exportação')
  tenantId = a.id
  dono = a.db
  const b = await negocio('Outro Negócio')
  outroTenant = b.id
  const ins = await svc.from('clients').insert([
    { tenant_id: tenantId, name: 'Conceição Ávila', phone_e164: '+5511999990001', email: 'conceicao@exemplo.com', birth_date: '1985-12-31', tags: ['vip'] },
    { tenant_id: tenantId, name: '-Ana Paula', phone_e164: '+5521988887777', tags: [] },
    { tenant_id: tenantId, name: 'Excluída', phone_e164: '+5511999990009', tags: [], deleted_at: new Date().toISOString() },
    { tenant_id: outroTenant, name: 'Cliente do Outro', phone_e164: '+5531977776666', tags: [] },
  ])
  if (ins.error) throw new Error(`seed clients: ${ins.error.message}`)
  const servico = (await svc.from('services').select('id').eq('tenant_id', tenantId).limit(1).single()).data!.id
  const cliente = (await svc.from('clients').select('id').eq('tenant_id', tenantId).eq('name', 'Conceição Ávila').single()).data!.id
  const pac = await svc.from('packages').insert({ tenant_id: tenantId, client_id: cliente, service_id: servico, total_sessions: 4, paid_cents: 32_000 })
  if (pac.error) throw new Error(`seed packages: ${pac.error.message}`)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('exportar a conta inteira (CNV-009b)', () => {
  it('o zip traz cada recurso nos dois formatos, o datapackage e o LEIA-ME', async () => {
    const { zip, contagens } = await exportarConta(dono, tenantId, 'Salão Exportação', new Date('2026-10-13T12:00:00Z'))
    const arquivos = unzipSync(zip)
    const nomes = Object.keys(arquivos)
    expect(nomes).toEqual(expect.arrayContaining(['clientes.csv', 'excel/Clientes.csv', 'servicos.csv', 'pacotes.csv', 'datapackage.json', 'LEIA-ME.txt']))
    expect(contagens.clientes, 'a excluída não sai').toBe(2)
    expect(contagens.pacotes).toBe(1)
    const pacote = JSON.parse(strFromU8(arquivos['datapackage.json']!)) as { resources: { name: string }[] }
    expect(pacote.resources.map((r) => r.name)).toContain('clientes')
  })

  it('nada de outro negócio entra (RLS + filtro por negócio)', async () => {
    const { zip } = await exportarConta(dono, tenantId, 'Salão Exportação')
    const tudo = Object.values(unzipSync(zip)).map((b) => strFromU8(b)).join('\n')
    expect(tudo).not.toContain('Cliente do Outro')
    expect(tudo).not.toContain('Excluída')
    expect(tudo).toContain('Conceição Ávila')
  })

  it('a planilha do Excel volta pela esteira com as mesmas pessoas (ida e volta)', async () => {
    const { zip } = await exportarConta(dono, tenantId, 'Salão Exportação')
    const excel = unzipSync(zip)['excel/Clientes.csv']!
    const r = processarGrade(gradeDeTexto(decodificar(excel).texto).grade, { hoje: '2026-10-13' })
    expect(r.registros.map((x) => x.nome).sort()).toEqual(['-Ana Paula', 'Conceição Ávila'])
    expect(r.registros.find((x) => x.nome === 'Conceição Ávila')).toMatchObject({ telefone: '+5511999990001', email: 'conceicao@exemplo.com', nascimento: '1985-12-31', etiquetas: ['vip'] })
  })
})
