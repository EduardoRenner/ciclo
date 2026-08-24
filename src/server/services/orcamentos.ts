import { z } from 'zod'

import { orcamentoExpirado, totalDoItem, totalDoOrcamento } from '@/core/orcamento/calcular'
import { notificarEquipe } from '@/server/services/mensageria'
import { resolverCliente } from '@/server/services/agendamentos'
import { gerarTokenOrcamento, verificarTokenOrcamento } from '@/server/services/orcamento-token'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const EsquemaItem = z.object({
  description: z.string().trim().min(1, 'Descreva o item.').max(300),
  qty: z.number().positive().max(9999),
  unitPriceCents: z.number().int().nonnegative(),
})

export const EsquemaCriarOrcamento = z
  .object({
    clientId: z.uuid().nullish(),
    clientDraft: z
      .object({ name: z.string().trim().min(2, 'Digite o nome do cliente.'), phone: z.string().trim().min(1, 'Digite o telefone do cliente.') })
      .nullish(),
    professionalId: z.uuid('Escolha um profissional.'),
    items: z.array(EsquemaItem).min(1, 'Adicione pelo menos um item.'),
    validUntil: z.iso.date().nullish(),
    message: z.string().trim().max(1000).nullish(),
  })
  .refine((d) => d.clientId ?? d.clientDraft, { message: 'Informe o cliente já cadastrado ou os dados dele.', path: ['clientId'] })

type EntradaCriarOrcamento = z.infer<typeof EsquemaCriarOrcamento>

async function profissionalDoTenant(db: Cliente, tenantId: string, professionalId: string): Promise<void> {
  const { data, error } = await db
    .from('professionals')
    .select('id')
    .eq('id', professionalId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw AppError.validacao({ professionalId: 'Esse profissional não está mais disponível.' })
}

/**
 * Nasce direto em `sent` (não `draft`) — o painel não tem uma tela de rascunho separada nesta
 * rodada (§19: escopo cortado pra caber o fluxo principal), então "montar o orçamento" e
 * "deixar pronto pra mandar" são o mesmo passo. `draft` continua existindo no enum pra um
 * fluxo de aprovação interna futuro não exigir migration de novo.
 */
export async function criarOrcamento(db: Cliente, tenantId: string, createdBy: string | null, entrada: EntradaCriarOrcamento) {
  const [clientId] = await Promise.all([resolverCliente(db, tenantId, entrada), profissionalDoTenant(db, tenantId, entrada.professionalId)])

  const totalCents = totalDoOrcamento(entrada.items)

  const { data: quote, error } = await db
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      professional_id: entrada.professionalId,
      status: 'sent',
      total_cents: totalCents,
      valid_until: entrada.validUntil ?? null,
      message: entrada.message ?? null,
      created_by: createdBy,
      sent_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error) throw new AppError('INTERNAL', { cause: error })

  const { error: erroItens } = await db.from('quote_items').insert(
    entrada.items.map((item) => ({
      tenant_id: tenantId,
      quote_id: quote.id,
      description: item.description,
      qty: item.qty,
      unit_price_cents: item.unitPriceCents,
      total_cents: totalDoItem(item),
    })),
  )
  if (erroItens) throw new AppError('INTERNAL', { cause: erroItens })

  return { quote, token: gerarTokenOrcamento(quote.id) }
}

export type OrcamentoPublico = {
  status: string
  totalCents: number
  validUntil: string | null
  message: string | null
  businessName: string
  items: { description: string; qty: number; unitPriceCents: number; totalCents: number }[]
}

/**
 * Sem autenticação (link do WhatsApp) — por isso não usa RLS de sessão: lê com service_role
 * (withNovoTenant, na rota) e o próprio token já prova que quem está vendo tem o link certo.
 * Expiração é preguiçosa: só materializa `status = 'expired'` quando alguém de fato tenta ler
 * ou aprovar depois do prazo — ninguém verifica orçamentos vencidos no fundo, então rodar isso
 * em cron seria trabalho sem plateia.
 */
export async function orcamentoPublico(db: Cliente, token: string): Promise<OrcamentoPublico> {
  const quoteId = verificarTokenOrcamento(token)
  if (!quoteId) throw new AppError('NOT_FOUND', { message: 'Link inválido ou expirado.' })

  const { data: quote, error } = await db
    .from('quotes')
    .select('id, tenant_id, status, total_cents, valid_until, message, tenants ( name, timezone )')
    .eq('id', quoteId)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!quote) throw new AppError('NOT_FOUND', { message: 'Esse orçamento não existe mais.' })

  const tenant = quote.tenants as unknown as { name: string; timezone: string }
  let status = quote.status
  if (status === 'sent' && orcamentoExpirado(quote.valid_until, tenant.timezone)) {
    status = 'expired'
    const { error: erroExpirar } = await db.from('quotes').update({ status: 'expired' }).eq('id', quote.id)
    if (erroExpirar) throw new AppError('INTERNAL', { cause: erroExpirar })
  }

  const { data: itens, error: erroItens } = await db.from('quote_items').select('description, qty, unit_price_cents, total_cents').eq('quote_id', quote.id)
  if (erroItens) throw new AppError('INTERNAL', { cause: erroItens })

  return {
    status,
    totalCents: quote.total_cents,
    validUntil: quote.valid_until,
    message: quote.message,
    businessName: tenant.name,
    items: (itens ?? []).map((i) => ({ description: i.description, qty: Number(i.qty), unitPriceCents: i.unit_price_cents, totalCents: i.total_cents })),
  }
}

/**
 * Sem `comIdempotencia` (mesmo padrão de `public/appointments/cancel` e `public/reviews`):
 * clicar duas vezes no mesmo botão não pode parecer erro — se já está no estado-alvo, devolve
 * o que já tem em vez de `INVALID_TRANSITION`. Só é erro de verdade tentar aprovar um
 * orçamento já recusado (ou vice-versa) ou vencido — aí sim quem clicou precisa saber.
 */
async function transicaoPublica(
  db: Cliente,
  token: string,
  alvo: 'approved' | 'rejected',
  camposExtra: Database['public']['Tables']['quotes']['Update'],
  notificacao: { title: string; body: string },
) {
  const quoteId = verificarTokenOrcamento(token)
  if (!quoteId) throw new AppError('NOT_FOUND', { message: 'Link inválido ou expirado.' })

  const { data: quote, error } = await db.from('quotes').select('id, tenant_id, status, valid_until, tenants ( timezone )').eq('id', quoteId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!quote) throw new AppError('NOT_FOUND', { message: 'Esse orçamento não existe mais.' })

  if (quote.status === alvo) return quote

  const timezone = (quote.tenants as unknown as { timezone: string }).timezone
  if (quote.status !== 'sent' || orcamentoExpirado(quote.valid_until, timezone)) {
    throw new AppError('INVALID_TRANSITION', { message: 'Esse orçamento não está mais esperando resposta.' })
  }

  const { data: atualizado, error: erroUpdate } = await db.from('quotes').update(camposExtra).eq('id', quote.id).select('*').single()
  if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })

  await notificarEquipe(db, quote.tenant_id, notificacao).catch(() => {
    // best-effort — igual ao resto do produto (mensageria.ts), notificação nunca trava a resposta do cliente
  })

  return atualizado
}

export function aprovarOrcamentoPublico(db: Cliente, token: string) {
  return transicaoPublica(
    db,
    token,
    'approved',
    { status: 'approved', approved_at: new Date().toISOString() },
    { title: 'Orçamento aprovado', body: 'Uma cliente aprovou um orçamento pelo link.' },
  )
}

export const EsquemaRecusarOrcamento = z.object({ reason: z.string().trim().max(500).nullish() })

export function recusarOrcamentoPublico(db: Cliente, token: string, entrada: z.infer<typeof EsquemaRecusarOrcamento>) {
  return transicaoPublica(
    db,
    token,
    'rejected',
    { status: 'rejected', rejected_at: new Date().toISOString(), rejected_reason: entrada.reason ?? null },
    { title: 'Orçamento recusado', body: 'Uma cliente recusou um orçamento pelo link.' },
  )
}

export type OrcamentoDaLista = {
  id: string
  token: string
  status: string
  totalCents: number
  validUntil: string | null
  createdAt: string
  clientId: string | null
  clientName: string
}

/**
 * A tela pública (`orcamentoPublico`) materializa `expired` de forma preguiçosa — só quando
 * alguém abre o link depois do prazo, porque "ninguém verifica orçamento vencido no fundo".
 * Esta lista **é** a primeira plateia real disso: o dono passa a ver o estado certo mesmo sem
 * ninguém ter clicado no link. Reusa `orcamentoExpirado` (mesma regra de negócio, um lugar só)
 * em vez de duplicar a comparação de fuso em SQL; o `update` em lote só toca o que de fato
 * mudou, então listar não vira escrita cara.
 */
export async function listarOrcamentos(db: Cliente, tenantId: string): Promise<OrcamentoDaLista[]> {
  const { data: tenant, error: erroTenant } = await db.from('tenants').select('timezone').eq('id', tenantId).single()
  if (erroTenant) throw new AppError('INTERNAL', { cause: erroTenant })

  const { data: quotes, error } = await db
    .from('quotes')
    .select('id, status, total_cents, valid_until, created_at, client_id, clients ( name )')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new AppError('INTERNAL', { cause: error })

  const idsVencidos: string[] = []
  const lista = (quotes ?? []).map((q) => {
    let status = q.status
    if (status === 'sent' && orcamentoExpirado(q.valid_until, tenant.timezone)) {
      status = 'expired'
      idsVencidos.push(q.id)
    }
    return {
      id: q.id,
      token: gerarTokenOrcamento(q.id),
      status,
      totalCents: q.total_cents,
      validUntil: q.valid_until,
      createdAt: q.created_at,
      clientId: q.client_id,
      clientName: (q.clients as unknown as { name: string } | null)?.name ?? 'Cliente removido',
    }
  })

  if (idsVencidos.length > 0) {
    const { error: erroExpirarLote } = await db.from('quotes').update({ status: 'expired' }).in('id', idsVencidos)
  if (erroExpirarLote) throw new AppError('INTERNAL', { cause: erroExpirarLote })
  }

  return lista
}

export const EsquemaConverterOrcamento = z.object({ appointmentId: z.uuid('Agendamento inválido.') })

/**
 * `quotes.converted_appointment_id` existe desde a migration `0028` (P8) — reservado pra este
 * momento e nunca lido. **Não** tenta escolher data/hora/serviço sozinho: os itens do orçamento
 * são texto livre (mão de obra + material, por exemplo), sem `service_id` nenhum por trás, então
 * não há como mapear pra um serviço do catálogo automaticamente. Quem decide isso continua sendo
 * o profissional na tela normal de "novo agendamento" — esta função só registra o vínculo depois
 * que o agendamento real já foi criado (a UI passa `?orcamento=<id>` pra pular a redigitação do
 * nome/telefone da cliente, ver `agenda/novo/formulario.tsx`).
 */
export async function converterOrcamentoEmAgendamento(db: Cliente, tenantId: string, quoteId: string, appointmentId: string) {
  const { data: quote, error } = await db.from('quotes').select('id, status').eq('id', quoteId).eq('tenant_id', tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!quote) throw new AppError('NOT_FOUND', { message: 'Esse orçamento não existe mais.' })
  if (quote.status !== 'approved') throw new AppError('INVALID_TRANSITION', { message: 'Só um orçamento aprovado pode virar agendamento.' })

  const { data: agendamento, error: erroAgendamento } = await db
    .from('appointments')
    .select('id')
    .eq('id', appointmentId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (erroAgendamento) throw new AppError('INTERNAL', { cause: erroAgendamento })
  if (!agendamento) throw new AppError('NOT_FOUND', { message: 'Esse agendamento não existe mais.' })

  const { data: atualizado, error: erroUpdate } = await db
    .from('quotes')
    .update({ status: 'converted', converted_appointment_id: appointmentId })
    .eq('id', quoteId)
    .select('*')
    .single()
  if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })

  return atualizado
}
