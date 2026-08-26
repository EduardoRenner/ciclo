import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { criarCliente } from '@/server/services/clientes'
import { importarClientes, preVisualizarCsv } from '@/server/services/importacao-clientes'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de importação precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const MAPA = { name: 'Nome', phone: 'Telefone', email: 'E-mail', tags: 'Etiquetas' }

let tenantId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `import-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Importação' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Importação',
    vertical: 'nails',
    slug: `import-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('preVisualizarCsv', () => {
  it('devolve cabeçalhos e uma amostra, sem tocar no banco', () => {
    const csv = 'Nome,Telefone\nAna,11987654321\nBia,11987654322\n'
    const preview = preVisualizarCsv(csv)
    expect(preview.colunas).toEqual(['Nome', 'Telefone'])
    expect(preview.sample).toHaveLength(2)
  })

  it('csv vazio ou sem cabeçalho estoura VALIDATION_ERROR', () => {
    expect(() => preVisualizarCsv('')).toThrow()
  })
})

describe('importarClientes — contra o projeto real', () => {
  it(
    'importa 500 linhas em menos de 10 segundos',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const linhas = Array.from(
        { length: 500 },
        (_, i) => `Cliente ${marca} ${i},119${String(10000000 + i).padStart(8, '0')},,`,
      )
      const csv = ['Nome,Telefone,E-mail,Etiquetas', ...linhas].join('\n')

      const inicio = Date.now()
      const resultado = await importarClientes(svc, tenantId, csv, MAPA)
      const duracao = Date.now() - inicio

      expect(resultado.imported).toBe(500)
      expect(resultado.errors).toEqual([])
      expect(duracao).toBeLessThan(10_000)
    },
    15_000,
  )

  it(
    'linha inválida não derruba o lote — as outras importam mesmo assim',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const csv = [
        'Nome,Telefone',
        `Boa Um ${marca},11955501111`,
        ',11955502222', // nome em branco
        `Ruim Telefone ${marca},10999999999`, // DDD 10 nunca existiu
        `Boa Dois ${marca},11955503333`,
      ].join('\n')

      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone' })

      expect(resultado.imported).toBe(2)
      expect(resultado.errors).toHaveLength(2)
      expect(resultado.errors.map((e) => e.linha)).toEqual([3, 4])
    },
    30_000,
  )

  it(
    'telefone repetido no próprio arquivo: a primeira importa, a repetida é sinalizada',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const telefone = `1195${String(6000000 + Math.floor(Math.random() * 900000)).padStart(7, '0')}`
      const csv = ['Nome,Telefone', `Primeira ${marca},${telefone}`, `Repetida ${marca},${telefone}`].join('\n')

      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone' })

      expect(resultado.imported).toBe(1)
      expect(resultado.skipped).toHaveLength(1)
      expect(resultado.skipped[0]?.motivo).toContain('repetido no próprio arquivo')
    },
    30_000,
  )

  it(
    'telefone que já existe no tenant é sinalizado, não importado de novo',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const telefone = `1196${String(1000000 + Math.floor(Math.random() * 900000)).padStart(7, '0')}`
      await criarCliente(svc, tenantId, { name: 'Já Existe', phone: telefone, tags: [], marketingOptIn: false })

      const csv = ['Nome,Telefone', `Duplicada ${marca},${telefone}`].join('\n')
      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone' })

      expect(resultado.imported).toBe(0)
      expect(resultado.skipped).toHaveLength(1)
      expect(resultado.skipped[0]?.motivo).toContain('Já existe')
    },
    30_000,
  )

  it(
    'cliente sem telefone é importada normalmente (D47)',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const csv = ['Nome,Telefone', `Sem Telefone ${marca},`].join('\n')

      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone' })
      expect(resultado.imported).toBe(1)
    },
    30_000,
  )
})

describe('importarClientes — previsão (F2/ticket 13, docs/25-ESTRATEGIA-E-EXECUCAO.md)', () => {
  it(
    'sem ninguém mapear a coluna de última visita, previsao é null',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const csv = ['Nome,Telefone', `Sem Previsao ${marca},`].join('\n')

      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone' })
      expect(resultado.previsao).toBeNull()
    },
    30_000,
  )

  it(
    'última visita há 2 anos: computeCycle de verdade marca como atrasado, em qualquer ciclo do tenant',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const duasAnosAtras = new Date()
      duasAnosAtras.setFullYear(duasAnosAtras.getFullYear() - 2)
      const dataIso = duasAnosAtras.toISOString().slice(0, 10)

      const csv = ['Nome,Telefone,UltimaVisita', `Sumida ${marca},,${dataIso}`].join('\n')
      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone', lastVisit: 'UltimaVisita' })

      expect(resultado.imported).toBe(1)
      expect(resultado.previsao).toEqual({ comDataInformada: 1, jaDevendoVoltar: 1 })
    },
    30_000,
  )

  it(
    'última visita ontem: dentro do ciclo, não conta como atrasado — mas conta em comDataInformada',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const ontem = new Date()
      ontem.setDate(ontem.getDate() - 1)
      const dataIso = ontem.toISOString().slice(0, 10)

      const csv = ['Nome,Telefone,UltimaVisita', `Veio Ontem ${marca},,${dataIso}`].join('\n')
      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone', lastVisit: 'UltimaVisita' })

      expect(resultado.imported).toBe(1)
      expect(resultado.previsao).toEqual({ comDataInformada: 1, jaDevendoVoltar: 0 })
    },
    30_000,
  )

  it(
    'data de última visita num formato que não é ISO: cliente importa igual, sem contar pra previsão',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const csv = ['Nome,Telefone,UltimaVisita', `Data Ruim ${marca},,10/03/2024`].join('\n')

      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone', lastVisit: 'UltimaVisita' })

      expect(resultado.imported).toBe(1)
      expect(resultado.errors).toEqual([])
      expect(resultado.previsao).toBeNull()
    },
    30_000,
  )

  it(
    'só conta quem foi de fato importado — a linha pulada por duplicata não entra na previsão',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const telefone = `1197${String(2000000 + Math.floor(Math.random() * 900000)).padStart(7, '0')}`
      await criarCliente(svc, tenantId, { name: 'Já Existe Com Previsao', phone: telefone, tags: [], marketingOptIn: false })

      const duasAnosAtras = new Date()
      duasAnosAtras.setFullYear(duasAnosAtras.getFullYear() - 2)
      const dataIso = duasAnosAtras.toISOString().slice(0, 10)

      const csv = ['Nome,Telefone,UltimaVisita', `Duplicada ${marca},${telefone},${dataIso}`].join('\n')
      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone', lastVisit: 'UltimaVisita' })

      expect(resultado.imported).toBe(0)
      expect(resultado.skipped).toHaveLength(1)
      expect(resultado.previsao).toBeNull()
    },
    30_000,
  )
})
