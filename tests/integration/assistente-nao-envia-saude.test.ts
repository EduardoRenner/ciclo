import { randomBytes, randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FERRAMENTAS } from '@/server/assistente/ferramentas'
import { executarLaco } from '@/server/services/assistente'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'
import type { AiProvider, RespostaDoModelo } from '@/server/providers/ai/types'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste do assistente precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * APR-032 (regra inviolável 9; auditoria do assistente de 09/09): dado de saúde nunca chega ao
 * modelo. O teste não confia em lista de chaves: planta uma cliente com ficha de saúde (alerta,
 * rótulo do alerta e o cifrado da anamnese), roda o laço REAL com as ferramentas REAIS contra o
 * banco local, e captura TUDO o que seria enviado ao provedor. Os valores plantados não podem
 * aparecer em lugar nenhum; o nome do serviço (controle positivo) tem que aparecer — senão o teste
 * passaria vazio, com o modelo sem ver nada.
 */
const ROTULO_PLANTADO = `ALERGIA-LATEX-${randomUUID().slice(0, 6)}`
const CIFRADO_PLANTADO = randomBytes(24).toString('base64')
let tenantId: string
let clientId: string
let nomeDoServico: string
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data } = await svc.auth.admin.createUser({ email: `apr032-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  usuarios.push(data.user!.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user!.id, businessName: 'Estética APR-032', vertical: 'barber', slug: `apr032-${marca}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id
  const servico = (await svc.from('services').select('id, name').eq('tenant_id', tenantId).limit(1).single()).data!
  nomeDoServico = servico.name
  const profissional = (await svc.from('professionals').select('id').eq('tenant_id', tenantId).limit(1).single()).data!
  clientId = (await svc.from('clients').insert({ tenant_id: tenantId, name: 'Fulana Saúde' }).select('id').single()).data!.id

  const ficha = await svc.from('health_records').insert({
    tenant_id: tenantId,
    client_id: clientId,
    form_key: 'anamnese',
    ciphertext: CIFRADO_PLANTADO,
    iv: randomBytes(12).toString('base64'),
    auth_tag: randomBytes(16).toString('base64'),
    key_version: 1,
    has_alert: true,
    alert_label: ROTULO_PLANTADO,
  } as never)
  if (ficha.error) throw ficha.error

  // Um horário hoje (resumo_de_hoje) e um passado concluído (histórico).
  for (const [dias, status] of [[0, 'confirmed'], [-20, 'done']] as const) {
    const inicio = new Date(Date.now() + dias * 86_400_000 + 3 * 3_600_000)
    const r = await svc.from('appointments').insert({
      tenant_id: tenantId,
      client_id: clientId,
      professional_id: profissional.id,
      service_id: servico.id,
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + 3_600_000).toISOString(),
      status,
      price_cents: 8_000,
    })
    if (r.error) throw r.error
  }
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('o assistente não envia dado de saúde ao modelo (APR-032)', () => {
  it(
    'busca, histórico e resumo do dia: nada da ficha de saúde no que vai ao provedor',
    async () => {
      const enviados: unknown[] = []
      const roteiro: RespostaDoModelo[] = [
        { tipo: 'chamada_ferramenta', nome: 'buscar_cliente', argumentos: JSON.stringify({ termo: 'Fulana' }) },
        { tipo: 'chamada_ferramenta', nome: 'historico_do_cliente', argumentos: JSON.stringify({ clientId }) },
        { tipo: 'chamada_ferramenta', nome: 'resumo_de_hoje', argumentos: '{}' },
        { tipo: 'texto', texto: 'pronto' },
      ]
      let i = 0
      const provider: AiProvider = {
        perguntar: async (entrada) => {
          enviados.push(JSON.parse(JSON.stringify(entrada)))
          return roteiro[i++]!
        },
      }

      await executarLaco({ provider, ferramentas: FERRAMENTAS, ctxFerramenta: { db: svc, tenantId, timezone: 'America/Sao_Paulo' }, pergunta: 'como está a Fulana?' })

      const tudo = JSON.stringify(enviados)
      // Controle positivo: as ferramentas rodaram e o modelo VIU a cliente e o serviço.
      expect(enviados.length).toBe(4)
      expect(tudo).toContain('Fulana Saúde')
      expect(tudo).toContain(nomeDoServico)
      // O que não pode ir, em valor e em nome de campo.
      expect(tudo).not.toContain(ROTULO_PLANTADO)
      expect(tudo).not.toContain(CIFRADO_PLANTADO)
      for (const chave of ['has_alert', 'alert_label', 'ciphertext', 'auth_tag']) expect(tudo, chave).not.toContain(chave)
      // `health_records` aparece no `resumo_de_hoje` como lista VAZIA por construção (`semDadoDeSaude`
      // mantém a forma do tipo). Toda ocorrência tem que ser essa lista vazia — nunca com conteúdo.
      const ocorrencias = tudo.split('health_records').length - 1
      const vazias = (tudo.match(/health_records\\*":\[\]/g) ?? []).length
      expect(vazias, 'health_records com conteúdo indo ao modelo').toBe(ocorrencias)
    },
    60_000,
  )
})
