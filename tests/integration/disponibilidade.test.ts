import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { describe, expect, it } from 'vitest'

import { disponibilidadeDoPainel } from '@/server/services/disponibilidade'
import { disponibilidadePublica } from '@/server/services/public-booking'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de disponibilidade precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}
const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * APR-110a: o "Marcar" do painel e o agendar público calculam os horários livres pela MESMA função.
 * Esta paridade é o que impede as duas telas de divergirem com as duas suítes verdes (memória
 * "Duas cópias da mesma fórmula"). Contra o seed de demonstração, num dia útil daqui a 3 dias.
 */
describe('horários livres: painel e público pela mesma conta', () => {
  it('para um serviço agendável online, o painel devolve exatamente os horários do público', async () => {
    const { data: tenant } = await svc.from('tenants').select('id, slug').eq('slug', 'demo-dom-estilo').single()
    expect(tenant, 'o seed de demonstração precisa estar no banco local').toBeTruthy()
    const { data: servico } = await svc
      .from('services')
      .select('id')
      .eq('tenant_id', tenant!.id)
      .eq('active', true)
      .eq('bookable_online', true)
      .is('deleted_at', null)
      .limit(1)
      .single()
    const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)

    const publico = await disponibilidadePublica(tenant!.slug, servico!.id, date)
    const painel = await disponibilidadeDoPainel(svc, tenant!.id, { serviceId: servico!.id, date })
    // O público só agrega profissionais com atendimento online; o painel, todos os ativos. Comparar o
    // subconjunto do público, que tem que estar inteiro no painel, horário por horário.
    const chave = (s: { startsAt: string; professionalId: string }) => `${s.startsAt}|${s.professionalId}`
    const doPainel = new Set(painel.map(chave))
    expect(publico.length, 'o cenário precisa ter horário livre, senão a paridade passa no vazio').toBeGreaterThan(0)
    for (const s of publico) expect(doPainel.has(chave(s)), `${chave(s)} está no público e não no painel`).toBe(true)
  }, 30_000)

  it('com profissional escolhido, só a agenda dele; serviço inexistente é recusado com motivo', async () => {
    const { data: tenant } = await svc.from('tenants').select('id').eq('slug', 'demo-dom-estilo').single()
    const { data: servico } = await svc.from('services').select('id').eq('tenant_id', tenant!.id).eq('active', true).limit(1).single()
    const { data: prof } = await svc.from('professionals').select('id').eq('tenant_id', tenant!.id).eq('active', true).limit(1).single()
    const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
    const so = await disponibilidadeDoPainel(svc, tenant!.id, { serviceId: servico!.id, date, professionalId: prof!.id })
    expect(so.every((s) => s.professionalId === prof!.id)).toBe(true)
    await expect(disponibilidadeDoPainel(svc, tenant!.id, { serviceId: '00000000-0000-4000-8000-000000000000', date })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  }, 30_000)
})
