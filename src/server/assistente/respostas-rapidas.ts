import { Temporal } from '@js-temporal/polyfill'

import type { ModuloKey } from '@/core/billing/planos'
import { dinheiro } from '@/lib/formato'
import { listarAgendaDoDia } from '@/server/services/agendamentos'
import { resumoDeHoje } from '@/server/services/resumo-hoje'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { resumoMensal } from '@/server/services/caixa'
import { listarOrcamentos } from '@/server/services/orcamentos'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>
type Permissao = `${string}:${string}`

/**
 * Sugestões prontas cuja resposta é 100% determinística a partir de um serviço que a própria
 * tela já usa — pular o Gemini nesses casos poupa 2-8s de latência (medido 2026-08-30) e todo o
 * custo/risco de chamada ao modelo por nada, já que a pergunta é sempre a mesma e a resposta
 * também. Cada id aqui precisa ter o par exato em `SUGESTOES_POR_ROTA`
 * (`assistente-flutuante.tsx`) — a rota `/api/v1/assistant/rapido` rejeita id fora desta lista.
 *
 * `modulo`/`permissao`: mesmo par que a ferramenta equivalente do Gemini usa em `ferramentas.ts`
 * — a resposta rápida lê o MESMO dado, então tem que exigir a MESMA permissão, nunca menos.
 */
export const IDS_RESPOSTA_RAPIDA = [
  'hoje_confirmar',
  'hoje_faturamento',
  'hoje_horario_vago_amanha',
  'recuperar_quem_primeiro',
  'recuperar_total_parado',
  'recuperar_sumidos_60',
  'caixa_faturamento_mes',
  'caixa_lucro_mes',
  'orcamentos_sem_resposta',
] as const
export type IdRespostaRapida = (typeof IDS_RESPOSTA_RAPIDA)[number]

export type ContextoRapido = { db: Cliente; tenantId: string; timezone: string }
export type RespostaRapida = { resposta: string; ferramentasUsadas: string[] }

export const PERMISSAO_POR_ID: Record<IdRespostaRapida, { modulo: ModuloKey; permissao: Permissao }> = {
  hoje_confirmar: { modulo: 'agenda', permissao: 'appointment:read' },
  hoje_faturamento: { modulo: 'agenda', permissao: 'appointment:read' },
  hoje_horario_vago_amanha: { modulo: 'agenda', permissao: 'appointment:read' },
  recuperar_quem_primeiro: { modulo: 'cycle_engine', permissao: 'client:read' },
  recuperar_total_parado: { modulo: 'cycle_engine', permissao: 'client:read' },
  recuperar_sumidos_60: { modulo: 'cycle_engine', permissao: 'client:read' },
  caixa_faturamento_mes: { modulo: 'register', permissao: 'report:read' },
  caixa_lucro_mes: { modulo: 'register', permissao: 'report:read' },
  orcamentos_sem_resposta: { modulo: 'quotes', permissao: 'appointment:read' },
}

// Limita a lista de nomes na frase — sem isto, um tenant com 40 clientes atrasadas vira uma
// parede de texto (mesma armadilha que o "cartão estruturado" do docs/26 §5 existe para evitar).
const MAX_NOMES_NA_FRASE = 8

function formatarHora(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(iso))
}

function formatarDataCurta(data: Temporal.PlainDate): string {
  return `${String(data.day).padStart(2, '0')}/${String(data.month).padStart(2, '0')}`
}

function mesCorrente(timezone: string): string {
  const hoje = Temporal.Now.instant().toZonedDateTimeISO(timezone).toPlainDate()
  return `${hoje.year}-${String(hoje.month).padStart(2, '0')}`
}

/** "A, B e C" — nunca "A, B, C" sem conectivo antes do último, que é como se fala em português. */
function listarComE(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? ''
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

function truncarLista(nomes: string[]): string {
  if (nomes.length <= MAX_NOMES_NA_FRASE) return listarComE(nomes)
  const restantes = nomes.length - MAX_NOMES_NA_FRASE
  return `${nomes.slice(0, MAX_NOMES_NA_FRASE).join(', ')} e mais ${restantes}`
}

async function hojeConfirmar(ctx: ContextoRapido): Promise<RespostaRapida> {
  const resumo = await resumoDeHoje(ctx.db, ctx.tenantId, ctx.timezone)
  const pendentes = resumo.restOfDay.filter((a) => a.status === 'pending')

  if (pendentes.length === 0) {
    return { resposta: 'Ninguém falta confirmar hoje. Tudo certo!', ferramentasUsadas: ['resumo_de_hoje'] }
  }

  const lista = pendentes.map((a) => `${a.clients?.name ?? 'Cliente'} (${formatarHora(a.starts_at, ctx.timezone)})`).join(', ')
  const verbo = pendentes.length === 1 ? 'falta' : 'faltam'
  return { resposta: `${pendentes.length} ${pendentes.length === 1 ? 'cliente' : 'clientes'} ${verbo} confirmar hoje: ${lista}.`, ferramentasUsadas: ['resumo_de_hoje'] }
}

async function hojeFaturamento(ctx: ContextoRapido): Promise<RespostaRapida> {
  const resumo = await resumoDeHoje(ctx.db, ctx.tenantId, ctx.timezone)
  return { resposta: `Você já faturou ${dinheiro.format(resumo.revenueTodayCents / 100)} hoje.`, ferramentasUsadas: ['resumo_de_hoje'] }
}

async function hojeHorarioVagoAmanha(ctx: ContextoRapido): Promise<RespostaRapida> {
  const hoje = Temporal.Now.instant().toZonedDateTimeISO(ctx.timezone).toPlainDate()
  const amanha = hoje.add({ days: 1 })
  const resumo = await listarAgendaDoDia(ctx.db, ctx.tenantId, amanha.toString(), ctx.timezone)
  const dataFmt = formatarDataCurta(amanha)
  const ocupacaoPct = Math.round(resumo.occupancyRate * 100)

  if (resumo.appointments.length === 0) {
    return { resposta: `Sim, amanhã (${dataFmt}) sua agenda está totalmente livre.`, ferramentasUsadas: ['ocupacao_do_dia'] }
  }
  // 2026-08-30, achado ao vivo: dia sem expediente cadastrado (ex.: domingo fechado) tem
  // occupancyRate=0 mesmo com agendamentos reais — "0% de ocupação" lê como dia vazio, que é
  // falso. Mesma correção da tela da Agenda (docs/DECISOES.md, mesma data).
  if (!resumo.temExpediente) {
    return {
      resposta: `Sim, amanhã (${dataFmt}) você tem horário vago — ${resumo.appointments.length} agendamento(s) marcado(s). Não há expediente cadastrado para esse dia.`,
      ferramentasUsadas: ['ocupacao_do_dia'],
    }
  }
  if (ocupacaoPct >= 100) {
    return { resposta: `Não, amanhã (${dataFmt}) sua agenda já está cheia (100% ocupada).`, ferramentasUsadas: ['ocupacao_do_dia'] }
  }
  return {
    resposta: `Sim, amanhã (${dataFmt}) você tem horário vago — ${resumo.appointments.length} agendamento(s) marcado(s), ${ocupacaoPct}% de ocupação.`,
    ferramentasUsadas: ['ocupacao_do_dia'],
  }
}

async function recuperarQuemPrimeiro(ctx: ContextoRapido): Promise<RespostaRapida> {
  const lista = await listarParaRecuperar(ctx.db, ctx.tenantId, { limit: 1 })
  const primeiro = lista.items[0]
  if (!primeiro) {
    return { resposta: 'Ninguém precisa ser chamado agora — a base inteira está em dia.', ferramentasUsadas: ['clientes_para_recuperar'] }
  }
  return {
    resposta: `Chame primeiro ${primeiro.name} — ${dinheiro.format(primeiro.valueCents / 100)} em risco, ${primeiro.lateDays} dia(s) sem voltar.`,
    ferramentasUsadas: ['clientes_para_recuperar'],
  }
}

async function recuperarTotalParado(ctx: ContextoRapido): Promise<RespostaRapida> {
  const lista = await listarParaRecuperar(ctx.db, ctx.tenantId, { limit: 1 })
  if (lista.count === 0) {
    return { resposta: 'Nada parado agora — toda a base está em dia.', ferramentasUsadas: ['clientes_para_recuperar'] }
  }
  return {
    resposta: `Você tem ${dinheiro.format(lista.totalValueCents / 100)} parado, esperando ${lista.count} cliente(s) voltar.`,
    ferramentasUsadas: ['clientes_para_recuperar'],
  }
}

async function recuperarSumidos60(ctx: ContextoRapido): Promise<RespostaRapida> {
  // `limit` da consulta é sobre a PÁGINA que a UI recebe, não sobre o total (docs em
  // `recuperar-receita.ts`) — 200 é o padrão da casa e já cobre qualquer base real de salão.
  const lista = await listarParaRecuperar(ctx.db, ctx.tenantId, { limit: 200 })
  const sumidos = lista.items.filter((i) => i.lateDays > 60)
  if (sumidos.length === 0) {
    return { resposta: 'Ninguém sumiu há mais de 60 dias.', ferramentasUsadas: ['clientes_para_recuperar'] }
  }
  const nomes = truncarLista(sumidos.map((i) => i.name))
  return {
    resposta: `${sumidos.length} cliente(s) sumida(s) há mais de 60 dias: ${nomes}.`,
    ferramentasUsadas: ['clientes_para_recuperar'],
  }
}

async function caixaFaturamentoMes(ctx: ContextoRapido): Promise<RespostaRapida> {
  const resumo = await resumoMensal(ctx.db, ctx.tenantId, ctx.timezone, mesCorrente(ctx.timezone))
  return { resposta: `Você faturou ${dinheiro.format(resumo.revenueCents / 100)} neste mês, até agora.`, ferramentasUsadas: ['faturamento_do_periodo'] }
}

async function caixaLucroMes(ctx: ContextoRapido): Promise<RespostaRapida> {
  const resumo = await resumoMensal(ctx.db, ctx.tenantId, ctx.timezone, mesCorrente(ctx.timezone))
  return {
    resposta: `Seu lucro neste mês foi de ${dinheiro.format(resumo.profitCents / 100)} — já descontado material, taxa e comissão.`,
    ferramentasUsadas: ['faturamento_do_periodo'],
  }
}

async function orcamentosSemResposta(ctx: ContextoRapido): Promise<RespostaRapida> {
  const todos = await listarOrcamentos(ctx.db, ctx.tenantId)
  const parados = todos.filter((o) => o.status === 'sent')
  if (parados.length === 0) {
    return { resposta: 'Nenhum orçamento parado — todos já tiveram resposta.', ferramentasUsadas: ['orcamentos_parados'] }
  }
  const nomes = truncarLista(parados.map((o) => o.clientName))
  return {
    resposta: `${parados.length} orçamento(s) sem resposta: ${nomes}.`,
    ferramentasUsadas: ['orcamentos_parados'],
  }
}

const RESPOSTAS: Record<IdRespostaRapida, (ctx: ContextoRapido) => Promise<RespostaRapida>> = {
  hoje_confirmar: hojeConfirmar,
  hoje_faturamento: hojeFaturamento,
  hoje_horario_vago_amanha: hojeHorarioVagoAmanha,
  recuperar_quem_primeiro: recuperarQuemPrimeiro,
  recuperar_total_parado: recuperarTotalParado,
  recuperar_sumidos_60: recuperarSumidos60,
  caixa_faturamento_mes: caixaFaturamentoMes,
  caixa_lucro_mes: caixaLucroMes,
  orcamentos_sem_resposta: orcamentosSemResposta,
}

export async function respostaRapida(id: IdRespostaRapida, ctx: ContextoRapido): Promise<RespostaRapida> {
  return RESPOSTAS[id](ctx)
}
