import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const DIAS_ALERTA_VENCIMENTO = 15

export const EsquemaVenderPacote = z.object({
  clientId: z.uuid(),
  serviceId: z.uuid(),
  totalSessions: z.number().int().min(1).max(100),
  paidCents: z.number().int().min(0),
  expiresOn: z.iso.date().nullish(),
})
type EntradaVenderPacote = z.infer<typeof EsquemaVenderPacote>

export type PacoteComSaldo = {
  id: string
  clientId: string
  serviceId: string
  totalSessions: number
  usedSessions: number
  remainingSessions: number
  paidCents: number
  expiresOn: string | null
  /** Negativo = já venceu. `null` = sem validade cadastrada. */
  daysUntilExpiry: number | null
  expiringSoon: boolean
}

export async function venderPacote(db: Cliente, tenantId: string, entrada: EntradaVenderPacote) {
  const { data, error } = await db
    .from('packages')
    .insert({
      tenant_id: tenantId,
      client_id: entrada.clientId,
      service_id: entrada.serviceId,
      total_sessions: entrada.totalSessions,
      paid_cents: entrada.paidCents,
      expires_on: entrada.expiresOn ?? null,
    })
    .select('*')
    .single()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

function comSaldo(p: Database['public']['Tables']['packages']['Row'], hoje: Temporal.PlainDate): PacoteComSaldo {
  const dueDate = p.expires_on ? Temporal.PlainDate.from(p.expires_on) : null
  const daysUntilExpiry = dueDate ? hoje.until(dueDate).total('days') : null

  return {
    id: p.id,
    clientId: p.client_id,
    serviceId: p.service_id,
    totalSessions: p.total_sessions,
    usedSessions: p.used_sessions,
    remainingSessions: p.total_sessions - p.used_sessions,
    paidCents: p.paid_cents,
    expiresOn: p.expires_on,
    daysUntilExpiry: daysUntilExpiry === null ? null : Math.trunc(daysUntilExpiry),
    // §criterio: "alerta em D-15 do vencimento" — só o que ainda tem sessão para gastar, um
    // pacote já esgotado não precisa avisar que está vencendo.
    expiringSoon: daysUntilExpiry !== null && daysUntilExpiry <= DIAS_ALERTA_VENCIMENTO && p.used_sessions < p.total_sessions,
  }
}

export async function listarPacotesDoCliente(db: Cliente, tenantId: string, clientId: string, hoje: string = Temporal.Now.plainDateISO().toString()): Promise<PacoteComSaldo[]> {
  const { data, error } = await db.from('packages').select('*').eq('tenant_id', tenantId).eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) throw new AppError('INTERNAL', { cause: error })

  const hojePlain = Temporal.PlainDate.from(hoje)
  return (data ?? []).map((p) => comSaldo(p, hojePlain))
}

/** Pacotes de qualquer cliente vencendo em até 15 dias, ainda com sessão sobrando — para alerta. */
export async function pacotesAVencerEmBreve(db: Cliente, tenantId: string, hoje: string = Temporal.Now.plainDateISO().toString()): Promise<PacoteComSaldo[]> {
  const hojePlain = Temporal.PlainDate.from(hoje)
  const limite = hojePlain.add({ days: DIAS_ALERTA_VENCIMENTO }).toString()

  const { data, error } = await db
    .from('packages')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('expires_on', 'is', null)
    .lte('expires_on', limite)
    .order('expires_on')
  if (error) throw new AppError('INTERNAL', { cause: error })

  return (data ?? []).map((p) => comSaldo(p, hojePlain)).filter((p) => p.expiringSoon)
}

/**
 * TICKET-048: "sessão consumida baixa saldo". CAS (compare-and-swap) via
 * `.eq('used_sessions', atual)`: se duas requisições chegarem juntas para o
 * mesmo pacote, só a primeira acha a linha com o valor esperado e ganha o
 * update — a segunda recebe `null` e o `SLOT_TAKEN` abaixo, em vez de as
 * duas incrementarem em cima do mesmo valor lido e uma sessão "sumir".
 */
export async function consumirSessao(db: Cliente, tenantId: string, packageId: string, appointmentId: string | null = null) {
  const { data: pacote, error: erroLeitura } = await db.from('packages').select('*').eq('id', packageId).eq('tenant_id', tenantId).maybeSingle()
  if (erroLeitura) throw new AppError('INTERNAL', { cause: erroLeitura })
  if (!pacote) throw new AppError('NOT_FOUND', { message: 'Esse pacote não existe mais.' })
  if (pacote.used_sessions >= pacote.total_sessions) {
    throw AppError.validacao({ packageId: 'Esse pacote não tem mais sessões disponíveis.' })
  }

  const { data: atualizado, error: erroUpdate } = await db
    .from('packages')
    .update({ used_sessions: pacote.used_sessions + 1 })
    .eq('id', packageId)
    .eq('tenant_id', tenantId)
    .eq('used_sessions', pacote.used_sessions)
    .select('*')
    .maybeSingle()
  if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })
  if (!atualizado) throw new AppError('SLOT_TAKEN', { message: 'Esse pacote acabou de ser usado em outro atendimento. Atualize e tente de novo.' })

  const { error: erroUso } = await db.from('package_uses').insert({ tenant_id: tenantId, package_id: packageId, appointment_id: appointmentId })
  if (erroUso) throw new AppError('INTERNAL', { cause: erroUso })

  return comSaldo(atualizado, Temporal.Now.plainDateISO())
}

export const EsquemaMovimentoCarteira = z.object({
  clientId: z.uuid(),
  amountCents: z.number().int().min(1),
  reason: z.string().trim().min(1).max(200),
  sourceId: z.uuid().nullish(),
  expiresOn: z.iso.date().nullish(),
})
type EntradaMovimentoCarteira = z.infer<typeof EsquemaMovimentoCarteira>

export async function saldoCarteira(db: Cliente, tenantId: string, clientId: string): Promise<number> {
  const { data, error } = await db.from('wallet_entries').select('amount_cents').eq('tenant_id', tenantId).eq('client_id', clientId)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return (data ?? []).reduce((soma, e) => soma + e.amount_cents, 0)
}

/** §5.8: sinal virado crédito, cortesia — sempre positivo aqui, o sinal na tabela já diz o resto. */
export async function creditarCarteira(db: Cliente, tenantId: string, entrada: EntradaMovimentoCarteira) {
  const { error } = await db.from('wallet_entries').insert({
    tenant_id: tenantId,
    client_id: entrada.clientId,
    amount_cents: entrada.amountCents,
    reason: entrada.reason,
    source_id: entrada.sourceId ?? null,
    expires_on: entrada.expiresOn ?? null,
  })
  if (error) throw new AppError('INTERNAL', { cause: error })
  return saldoCarteira(db, tenantId, entrada.clientId)
}

/**
 * Debita da carteira — recusa se o saldo não cobre, para nunca deixar a cliente devendo pro
 * salão sem querer.
 *
 * A decisão inteira roda no banco (`debitar_carteira`, migration 0034), numa transação só.
 * A versão anterior somava aqui, comparava aqui e inseria aqui, em três idas de rede: cinco
 * débitos em paralelo liam o mesmo saldo e passavam todos (auditoria de segurança, achado S11).
 * Nenhuma constraint segurava, porque a regra vivia no `if` do JavaScript, não no schema —
 * `wallet_entries` é livro-razão, e ninguém pode barrar a SOMA de linhas com um `check` de linha.
 *
 * `consumirSessao`, logo acima, já resolvia o mesmo problema do jeito certo (update condicional que
 * devolve zero linhas quando perde a corrida). Isto aqui era a exceção, não a regra da casa.
 */
export async function debitarCarteira(db: Cliente, tenantId: string, entrada: EntradaMovimentoCarteira) {
  const { data, error } = await db.rpc('debitar_carteira', {
    p_tenant: tenantId,
    p_client: entrada.clientId,
    p_valor: entrada.amountCents,
    p_reason: entrada.reason,
    p_source: entrada.sourceId ?? undefined,
  })

  if (error) {
    // Distinguido por `code`, nunca pelo texto: a mensagem em pt-BR é da interface e muda sem
    // avisar; o errcode é contrato com o banco. `53000` é o que a função levanta quando o saldo
    // não cobre — é recusa esperada, não falha do servidor.
    if (error.code === '53000') throw AppError.validacao({ amountCents: 'Saldo insuficiente na carteira dessa cliente.' })
    if (error.code === 'P0002') throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })
    throw new AppError('INTERNAL', { cause: error })
  }

  return data ?? 0
}
