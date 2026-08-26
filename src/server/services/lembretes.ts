import { lembretesDevidos } from '@/core/reminders/schedule'
import { ehDemonstracao } from '@/core/tenants/demonstracao'
import { gerarTokenConfirmacao } from '@/server/services/confirmacao-token'
import { enviarComFallback } from '@/server/services/mensageria'
import { AppError } from '@/server/http/errors'

import type { MessagingProvider } from '@/server/providers/messaging/types'
import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const COLUNAS_CANDIDATO =
  'id, tenant_id, client_id, starts_at, status, clients ( name, phone_e164, email, whatsapp_opt_out ), services ( name ), tenants ( name, slug, timezone, phone )'

type LinhaCandidata = {
  id: string
  tenant_id: string
  client_id: string | null
  starts_at: string
  status: string
  clients: { name: string; phone_e164: string | null; email: string | null; whatsapp_opt_out: boolean } | null
  services: { name: string } | null
  tenants: { name: string; slug: string; timezone: string; phone: string | null } | null
}

export type EnvioPendente = {
  appointmentId: string
  tenantId: string
  clientId: string
  kind: 'confirmation' | 'reminder'
  template: 'confirmacao_d1' | 'lembrete_d0'
  whatsappTo: string
  emailTo: string | null
  fallbackSubject: string
  fallbackBody: string
}

const NOME_MENSAGEM: Record<'confirmation' | 'reminder', string> = {
  confirmation: 'Confirmação de agendamento',
  reminder: 'Lembrete de agendamento',
}

/**
 * TICKET-030. Janela de busca: dos próximos 36h — cobre D-1 18h e D-0 T-3h
 * com folga, sem escanear todo o futuro da agenda a cada 15 minutos.
 */
export async function identificarLembretesPendentes(db: Cliente, now: string): Promise<EnvioPendente[]> {
  const agora = new Date(now)
  const fimJanela = new Date(agora.getTime() + 36 * 3_600_000).toISOString()

  const { data: candidatos, error } = await db
    .from('appointments')
    .select(COLUNAS_CANDIDATO)
    .in('status', ['pending', 'confirmed'])
    .gte('starts_at', now)
    .lte('starts_at', fimJanela)
  if (error) throw new AppError('INTERNAL', { cause: error })

  const linhas = (candidatos ?? []) as unknown as LinhaCandidata[]
  if (linhas.length === 0) return []

  const { data: jaEnviadas, error: erroMsgs } = await db
    .from('messages')
    .select('appointment_id, kind, template')
    .in(
      'appointment_id',
      linhas.map((l) => l.id),
    )
    .in('kind', ['confirmation', 'reminder'])
  if (erroMsgs) throw new AppError('INTERNAL', { cause: erroMsgs })

  const jaTem = new Set((jaEnviadas ?? []).map((m) => `${m.appointment_id}:${m.kind}:${m.template}`))

  const pendentes: EnvioPendente[] = []

  for (const linha of linhas) {
    if (!linha.clients || !linha.tenants || linha.clients.whatsapp_opt_out) continue
    // Tenant de demonstração não tem cliente de verdade do outro lado do telefone.
    if (ehDemonstracao(linha.tenants.slug)) continue
    // Confirmação transacional passa por cima de opt-out de marketing (H110),
    // mas sem telefone não tem para onde mandar — nem WhatsApp nem SMS existe.
    if (!linha.clients.phone_e164) continue

    const devidos = lembretesDevidos(linha.starts_at, linha.tenants.timezone, now)

    for (const devido of devidos) {
      if (jaTem.has(`${linha.id}:${devido.kind}:${devido.template}`)) continue

      const dataHora = new Date(linha.starts_at).toLocaleString('pt-BR', {
        timeZone: linha.tenants.timezone,
        dateStyle: 'short',
        timeStyle: 'short',
      })

      pendentes.push({
        appointmentId: linha.id,
        tenantId: linha.tenant_id,
        clientId: linha.client_id!,
        kind: devido.kind,
        template: devido.template,
        whatsappTo: linha.clients.phone_e164,
        emailTo: linha.clients.email,
        fallbackSubject: `${NOME_MENSAGEM[devido.kind]} · ${linha.tenants.name}`,
        fallbackBody:
          devido.kind === 'confirmation'
            ? `Você tem ${linha.services?.name ?? 'um horário'} marcado em ${linha.tenants.name} no dia ${dataHora}. Responda para confirmar.`
            : `Lembrete: seu horário de ${linha.services?.name ?? ''} em ${linha.tenants.name} é hoje, ${dataHora}.`,
      })
    }
  }

  return pendentes
}

/**
 * Manda cada lembrete pendente (via `enviarComFallback`, TICKET-028) com o
 * link de confirmação sem login (TICKET-030) embutido nos parâmetros do
 * template. O dedupe real de "nunca duas vezes" é o unique index de
 * `messages` — `identificarLembretesPendentes` já filtra o óbvio, isto aqui
 * é a segunda camada para quando dois runs do job se sobrepõem.
 */
export async function enviarLembretesPendentes(
  db: Cliente,
  now: string,
  appUrl: string,
  provider?: MessagingProvider,
): Promise<{ enviados: number }> {
  const pendentes = await identificarLembretesPendentes(db, now)

  let enviados = 0
  for (const p of pendentes) {
    const token = gerarTokenConfirmacao(p.appointmentId)
    const linkConfirmacao = `${appUrl}/confirmar/${token}`

    const resultado = await enviarComFallback(
      db,
      {
        tenantId: p.tenantId,
        clientId: p.clientId,
        appointmentId: p.appointmentId,
        kind: p.kind,
        template: p.template,
        params: { link: linkConfirmacao },
        fallbackSubject: p.fallbackSubject,
        fallbackBody: `${p.fallbackBody}\n\n${linkConfirmacao}`,
        whatsappTo: p.whatsappTo,
        emailTo: p.emailTo,
      },
      provider,
    )
    if (resultado.status === 'sent') enviados++
  }

  return { enviados }
}
