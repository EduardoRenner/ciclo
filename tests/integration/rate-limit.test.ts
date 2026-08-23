import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import { limitador } from '@/server/services/rate-limit'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de rate limit precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const chavesCriadas: string[] = []
function chaveNova(prefixo: string): string {
  const k = `teste:${prefixo}:${randomUUID()}`
  chavesCriadas.push(k)
  return k
}

afterAll(async () => {
  for (const k of chavesCriadas) await svc.from('rate_limits').delete().eq('key', k)
}, 30_000)

/**
 * Achado S4 da auditoria de 2026-08-23. `limitador()` caía num `Map` do processo porque o
 * Upstash nunca foi provisionado (conferido com `vercel env ls production`) — em deploy
 * serverless isso é um balde por instância viva, e o "5/min por IP" do agendamento público
 * valia por instância, não por IP.
 */
describe('limitador compartilhado (achado S4)', () => {
  it(
    'conta no Postgres, não na memória do processo',
    async () => {
      const chave = chaveNova('grava')
      await limitador(chave, { limite: 5, janelaSegundos: 60 })

      // É esta linha que separa "contou" de "contou onde todo mundo enxerga". Com o balde em
      // memória, a tabela ficaria vazia e o teste abaixo (dos limites) passaria mesmo assim.
      const linha = await svc.from('rate_limits').select('key, count').eq('key', chave).maybeSingle()
      expect(linha.data?.count).toBe(1)
    },
    30_000,
  )

  it(
    'libera até o limite e recusa a partir dele',
    async () => {
      const chave = chaveNova('limite')
      const resultados = []
      for (let i = 0; i < 4; i++) resultados.push(await limitador(chave, { limite: 3, janelaSegundos: 60 }))

      expect(resultados.map((r) => r.permitido)).toEqual([true, true, true, false])
      expect(resultados[2]!.restante).toBe(0)
    },
    30_000,
  )

  it(
    'uma SEGUNDA instância continua a contagem da primeira — o coração do S4',
    async () => {
      const chave = chaveNova('instancias')

      // "Instância A": o processo deste teste, com seu Map em memória.
      for (let i = 0; i < 3; i++) await limitador(chave, { limite: 3, janelaSegundos: 60 })

      // "Instância B": outro processo, que nunca viu esse Map. Antes da correção começaria do
      // zero e liberaria mais 3; agora encontra a contagem que a A deixou e recusa na primeira.
      const outraInstancia = await svc.rpc('consumir_rate_limit', {
        p_key: chave,
        p_limite: 3,
        p_janela_segundos: 60,
      })
      if (outraInstancia.error) throw outraInstancia.error

      const linha = Array.isArray(outraInstancia.data) ? outraInstancia.data[0] : outraInstancia.data
      expect(linha?.permitido).toBe(false)
    },
    30_000,
  )

  it(
    'janela vencida reinicia a contagem em vez de somar em cima do que já passou',
    async () => {
      const chave = chaveNova('janela')
      await limitador(chave, { limite: 2, janelaSegundos: 60 })
      await limitador(chave, { limite: 2, janelaSegundos: 60 })
      expect((await limitador(chave, { limite: 2, janelaSegundos: 60 })).permitido).toBe(false)

      // Envelhece a janela à mão em vez de esperar 60s de relógio.
      await svc.from('rate_limits').update({ expires_at: new Date(Date.now() - 1_000).toISOString() }).eq('key', chave)

      const depois = await limitador(chave, { limite: 2, janelaSegundos: 60 })
      expect(depois.permitido).toBe(true)
      expect(depois.restante).toBe(1)
    },
    30_000,
  )

  it(
    '`somenteMemoria` não encosta no banco — é a exceção consciente do teto global',
    async () => {
      const chave = chaveNova('so-memoria')
      await limitador(chave, { limite: 5, janelaSegundos: 60, somenteMemoria: true })

      const linha = await svc.from('rate_limits').select('key').eq('key', chave).maybeSingle()
      expect(linha.data).toBeNull()
    },
    30_000,
  )

  it(
    'a função não é executável por anon nem por authenticated',
    async () => {
      // Ela conta em nome de terceiros; publicada em /rest/v1/rpc/ sem sessão, viraria uma forma
      // de queimar o limite de outra pessoa. Mesma regra da 0004 para função que escreve.
      const anon = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const r = await anon.rpc('consumir_rate_limit', { p_key: 'x', p_limite: 1, p_janela_segundos: 60 })
      expect(r.error).not.toBeNull()
    },
    30_000,
  )
})
