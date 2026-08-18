import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterEach, describe, expect, it } from 'vitest'

import { enfileirar, processarLote, type Job } from '@/server/services/job-queue'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de fila de jobs precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const KINDS_CRIADOS: string[] = []

afterEach(async () => {
  // job_queue não tem tenant_id obrigatório (jobs de sistema, tipo lgpd_retention,
  // não pertencem a um tenant) — a limpeza é por `kind`, não por tenant.
  for (const kind of KINDS_CRIADOS.splice(0)) await svc.from('job_queue').delete().eq('kind', kind)
})

function kindDoTeste(prefixo: string): string {
  const kind = `${prefixo}_${randomUUID().slice(0, 8)}`
  KINDS_CRIADOS.push(kind)
  return kind
}

describe('enfileirar + processarLote', () => {
  it(
    'processa o job com o handler certo e marca done',
    async () => {
      const kind = kindDoTeste('teste_simples')
      await enfileirar(svc, { kind, payload: { valor: 42 } })

      const recebidos: unknown[] = []
      const resultado = await processarLote(svc, {
        [kind]: async (job: Job) => {
          recebidos.push(job.payload)
        },
      })

      expect(resultado.processados).toBe(1)
      expect(recebidos).toEqual([{ valor: 42 }])

      const linha = await svc.from('job_queue').select('status').eq('kind', kind).single()
      expect(linha.data?.status).toBe('done')
    },
    30_000,
  )

  it(
    'dedupeKey repetido não insere duas vezes',
    async () => {
      const kind = kindDoTeste('teste_dedupe')
      const chave = randomUUID()

      const primeiro = await enfileirar(svc, { kind, payload: {}, dedupeKey: chave })
      const segundo = await enfileirar(svc, { kind, payload: {}, dedupeKey: chave })

      expect(primeiro).not.toBeNull()
      expect(segundo).toBeNull()

      const { count } = await svc.from('job_queue').select('id', { count: 'exact', head: true }).eq('kind', kind)
      expect(count).toBe(1)
    },
    30_000,
  )

  it(
    'job sem handler registrado morre na hora — nunca falha em silêncio',
    async () => {
      const kind = kindDoTeste('sem_handler')
      // maxAttempts: 1 para testar "morre na hora" sem esperar o retry — com
      // o padrão (5), a falta de handler seria só a 1ª de 5 tentativas
      // (comportamento correto: um handler pode nascer num deploy seguinte).
      await enfileirar(svc, { kind, payload: {}, maxAttempts: 1 })

      const resultado = await processarLote(svc, {})
      expect(resultado.mortos).toBe(1)

      const linha = await svc.from('job_queue').select('status, last_error').eq('kind', kind).single()
      expect(linha.data?.status).toBe('dead')
      expect(linha.data?.last_error).toMatch(/handler/)
    },
    30_000,
  )

  it(
    'falha com max_attempts=1 vai direto pra dead, não fica em failed esperando retry',
    async () => {
      const kind = kindDoTeste('falha_direto_dead')
      await enfileirar(svc, { kind, payload: {}, maxAttempts: 1 })

      const resultado = await processarLote(svc, {
        [kind]: async () => {
          throw new Error('falha simulada')
        },
      })

      expect(resultado.mortos).toBe(1)
      expect(resultado.falharam).toBe(0)

      const linha = await svc.from('job_queue').select('status, attempts, last_error').eq('kind', kind).single()
      expect(linha.data).toMatchObject({ status: 'dead', attempts: 1, last_error: 'falha simulada' })
    },
    30_000,
  )

  it(
    'falha com margem pra retry vira failed com run_after no futuro, e não é reivindicado de novo na mesma hora',
    async () => {
      const kind = kindDoTeste('falha_com_retry')
      await enfileirar(svc, { kind, payload: {}, maxAttempts: 5 })

      let chamadas = 0
      await processarLote(svc, {
        [kind]: async () => {
          chamadas++
          throw new Error('falha transitória')
        },
      })
      expect(chamadas).toBe(1)

      const linha = await svc.from('job_queue').select('status, run_after, attempts').eq('kind', kind).single()
      expect(linha.data?.status).toBe('failed')
      expect(linha.data?.attempts).toBe(1)
      expect(new Date(linha.data!.run_after).getTime()).toBeGreaterThan(Date.now())

      // Um segundo lote não reivindica o job — o backoff ainda não venceu.
      const segundoLote = await processarLote(svc, {
        [kind]: async () => {
          chamadas++
        },
      })
      expect(segundoLote.processados).toBe(0)
      expect(chamadas).toBe(1)
    },
    30_000,
  )

  it(
    '1.000 jobs processam sem duplicar, mesmo com vários workers concorrentes',
    async () => {
      const kind = kindDoTeste('mil_jobs')
      const TOTAL = 1000

      const linhas = Array.from({ length: TOTAL }, (_, i) => ({ kind, payload: { i } }))
      for (let inicio = 0; inicio < TOTAL; inicio += 200) {
        const lote = linhas.slice(inicio, inicio + 200)
        const { error } = await svc.from('job_queue').insert(lote as never)
        if (error) throw error
      }

      const idsVistos = new Set<number>()
      let duplicados = 0

      const handlers = {
        [kind]: async (job: Job) => {
          if (idsVistos.has(job.id)) duplicados++
          idsVistos.add(job.id)
        },
      }

      // Vários "workers" reivindicando em paralelo — é o SKIP LOCKED sendo
      // testado sob concorrência de verdade, não só sequencialmente.
      async function drenar() {
        let processadosNesseWorker = 0
        for (;;) {
          const r = await processarLote(svc, handlers, 100)
          if (r.processados === 0) break
          processadosNesseWorker += r.processados
        }
        return processadosNesseWorker
      }

      const porWorker = await Promise.all([drenar(), drenar(), drenar(), drenar()])
      const totalProcessado = porWorker.reduce((a, b) => a + b, 0)

      expect(duplicados).toBe(0)
      expect(idsVistos.size).toBe(TOTAL)
      expect(totalProcessado).toBe(TOTAL)

      const { count: aindaNaFila } = await svc
        .from('job_queue')
        .select('id', { count: 'exact', head: true })
        .eq('kind', kind)
        .neq('status', 'done')
      expect(aindaNaFila).toBe(0)
    },
    60_000,
  )
})
