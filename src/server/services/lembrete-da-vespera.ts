import { Temporal } from '@js-temporal/polyfill'

import { APP_URL } from '@/lib/app-url'
import { textoDoLembreteDaVespera } from '@/lib/mensagens'
import { AppError } from '@/server/http/errors'
import { gerarTokenDeGestao } from '@/server/services/confirmacao-token'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * docs/114 L-07 (parte 2): o lembrete da véspera que a profissional manda pelo próprio WhatsApp, com
 * um toque, enquanto a Meta não está ligada. Devolve o número de quem marcou e o texto pronto: o
 * "Lembrete de amanhã" do negócio e o link de remarcar ou cancelar deste horário. `null` quando não
 * há o que lembrar (desmarcado, já atendido, sem telefone ou pediu para não receber).
 *
 * Pelo cliente do usuário: a RLS de `appointments` já limita a profissional aos horários dela.
 */
export async function lembreteDaVespera(
  db: Cliente,
  tenantId: string,
  appointmentId: string,
  escopo: 'all' | 'own' = 'all',
): Promise<{ telefone: string; texto: string } | null> {
  const { data, error } = await db
    .from('appointments')
    .select('id, starts_at, status, professional_id, clients(name, phone_e164, whatsapp_opt_out), services(name), tenants(name, timezone)')
    .eq('tenant_id', tenantId)
    .eq('id', appointmentId)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  // APR-040: o `own` do profissional vale aqui também — o lembrete leva o telefone de quem marcou.
  if (data && escopo === 'own') {
    const { data: eu, error: erroEu } = await db.rpc('my_professional_id', { t: tenantId })
    if (erroEu) throw new AppError('INTERNAL', { cause: erroEu })
    if (!eu || data.professional_id !== eu) throw new AppError('FORBIDDEN', { message: 'Só quem atende este horário manda o lembrete.' })
  }
  if (!data || !['pending', 'confirmed'].includes(data.status) || !data.clients?.phone_e164 || data.clients.whatsapp_opt_out || !data.tenants) return null

  const { data: modelo } = await db
    .from('message_templates')
    .select('body, active')
    .eq('tenant_id', tenantId)
    .eq('slug', 'lembrete')
    .maybeSingle()

  const quando = Temporal.Instant.from(data.starts_at).toZonedDateTimeISO(data.tenants.timezone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    telefone: data.clients.phone_e164,
    texto: textoDoLembreteDaVespera({
      modelo: modelo ?? null,
      nome: data.clients.name,
      servico: data.services?.name ?? 'atendimento',
      data: `${pad(quando.day)}/${pad(quando.month)}`,
      hora: `${pad(quando.hour)}:${pad(quando.minute)}`,
      negocio: data.tenants.name,
      link: `${APP_URL}/confirmar/${gerarTokenDeGestao(data.id, data.starts_at)}`,
    }),
  }
}
