import { Temporal } from '@js-temporal/polyfill'

import type { ModuloKey } from '@/core/billing/planos'
import { mesAtual } from '@/core/tempo/dia'
import {
  falarAtendidoHoje,
  falarConfirmacoesDeHoje,
  falarFaturamento,
  falarOcupacaoDoDia,
  falarOrcamentosSemResposta,
  falarQuemChamarPrimeiro,
  falarSobra,
  falarSumidosHaMaisDe,
  falarTotalParaRecuperar,
  rotuloDoDia,
} from '@/core/inteligencia/falar'
import { listarAgendaDoDia } from '@/server/services/agendamentos'
import { resumoDeHoje } from '@/server/services/resumo-hoje'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { resumoMensal } from '@/server/services/caixa'
import { listarOrcamentos } from '@/server/services/orcamentos'
import { lerCustoFixoDoTenant } from '@/server/services/custo-fixo'
import { lerTaxasDoTenant } from '@/server/services/taxas-de-pagamento'

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
  'hoje_atendido',
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
  hoje_atendido: { modulo: 'agenda', permissao: 'appointment:read' },
  hoje_horario_vago_amanha: { modulo: 'agenda', permissao: 'appointment:read' },
  recuperar_quem_primeiro: { modulo: 'cycle_engine', permissao: 'client:read' },
  recuperar_total_parado: { modulo: 'cycle_engine', permissao: 'client:read' },
  recuperar_sumidos_60: { modulo: 'cycle_engine', permissao: 'client:read' },
  caixa_faturamento_mes: { modulo: 'register', permissao: 'report:read' },
  caixa_lucro_mes: { modulo: 'register', permissao: 'report:read' },
  orcamentos_sem_resposta: { modulo: 'quotes', permissao: 'appointment:read' },
}

function formatarHora(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(iso))
}

/*
  A FRASE não mora aqui: mora em `core/inteligencia/falar.ts`, junto com o porquê de cada palavra
  ("atendeu" e não "faturou", "sobrou" e não "lucro", "fechada" e não "vazia"). O Motor de
  Inteligência diz as mesmas coisas pela mesma função — duas cópias da mesma frase divergem com as
  duas suítes verdes. Aqui fica só a busca do dado, que é o que a resposta rápida tem de próprio.
*/

async function hojeConfirmar(ctx: ContextoRapido): Promise<RespostaRapida> {
  const resumo = await resumoDeHoje(ctx.db, ctx.tenantId, ctx.timezone)
  const pendentes = resumo.restOfDay
    .filter((a) => a.status === 'pending')
    .map((a) => ({ nome: a.clients?.name ?? 'Cliente', hora: formatarHora(a.starts_at, ctx.timezone) }))
  return { resposta: falarConfirmacoesDeHoje(pendentes), ferramentasUsadas: ['resumo_de_hoje'] }
}

async function hojeAtendido(ctx: ContextoRapido): Promise<RespostaRapida> {
  const resumo = await resumoDeHoje(ctx.db, ctx.tenantId, ctx.timezone)
  return { resposta: falarAtendidoHoje(resumo.revenueTodayCents), ferramentasUsadas: ['resumo_de_hoje'] }
}

async function hojeHorarioVagoAmanha(ctx: ContextoRapido): Promise<RespostaRapida> {
  const hoje = Temporal.Now.instant().toZonedDateTimeISO(ctx.timezone).toPlainDate()
  const amanha = hoje.add({ days: 1 })
  const resumo = await listarAgendaDoDia(ctx.db, ctx.tenantId, amanha.toString(), ctx.timezone)
  return {
    resposta: falarOcupacaoDoDia({
      rotulo: rotuloDoDia(amanha, hoje),
      quantidade: resumo.appointments.length,
      taxa: resumo.occupancyRate,
      temExpediente: resumo.temExpediente,
    }),
    ferramentasUsadas: ['ocupacao_do_dia'],
  }
}

async function recuperarQuemPrimeiro(ctx: ContextoRapido): Promise<RespostaRapida> {
  const lista = await listarParaRecuperar(ctx.db, ctx.tenantId, { limit: 1 })
  const primeiro = lista.items[0]
  return {
    resposta: falarQuemChamarPrimeiro(primeiro ? { nome: primeiro.name, valorCents: primeiro.valueCents, diasAtrasado: primeiro.lateDays } : null),
    ferramentasUsadas: ['clientes_para_recuperar'],
  }
}

async function recuperarTotalParado(ctx: ContextoRapido): Promise<RespostaRapida> {
  const lista = await listarParaRecuperar(ctx.db, ctx.tenantId, { limit: 1 })
  return { resposta: falarTotalParaRecuperar(lista.count, lista.totalValueCents), ferramentasUsadas: ['clientes_para_recuperar'] }
}

async function recuperarSumidos60(ctx: ContextoRapido): Promise<RespostaRapida> {
  // `limit` da consulta é sobre a PÁGINA que a UI recebe, não sobre o total (docs em
  // `recuperar-receita.ts`) — 200 é o padrão da casa e já cobre qualquer base real de salão.
  const lista = await listarParaRecuperar(ctx.db, ctx.tenantId, { limit: 200 })
  const nomes = lista.items.filter((i) => i.lateDays > 60).map((i) => i.name)
  return { resposta: falarSumidosHaMaisDe(60, nomes), ferramentasUsadas: ['clientes_para_recuperar'] }
}

async function caixaFaturamentoMes(ctx: ContextoRapido): Promise<RespostaRapida> {
  const resumo = await resumoMensal(ctx.db, ctx.tenantId, ctx.timezone, mesAtual(ctx.timezone))
  return { resposta: falarFaturamento(resumo.revenueCents, 'neste mês, até agora'), ferramentasUsadas: ['faturamento_do_periodo'] }
}

// As condições da maquininha e do custo fixo saem das MESMAS fontes que a tela do caixa usa
// (`lerTaxasDoTenant`, `lerCustoFixoDoTenant`), para as duas não divergirem depois.
async function caixaSobrouMes(ctx: ContextoRapido): Promise<RespostaRapida> {
  const [resumo, taxas, custoFixo] = await Promise.all([
    resumoMensal(ctx.db, ctx.tenantId, ctx.timezone, mesAtual(ctx.timezone)),
    lerTaxasDoTenant(ctx.db, ctx.tenantId),
    lerCustoFixoDoTenant(ctx.db, ctx.tenantId),
  ])
  return { resposta: falarSobra(resumo.profitCents, 'neste mês', taxas.respondida, custoFixo.respondido), ferramentasUsadas: ['faturamento_do_periodo'] }
}

async function orcamentosSemResposta(ctx: ContextoRapido): Promise<RespostaRapida> {
  const todos = await listarOrcamentos(ctx.db, ctx.tenantId)
  const nomes = todos.filter((o) => o.status === 'sent').map((o) => o.clientName)
  return { resposta: falarOrcamentosSemResposta(nomes), ferramentasUsadas: ['orcamentos_parados'] }
}

const RESPOSTAS: Record<IdRespostaRapida, (ctx: ContextoRapido) => Promise<RespostaRapida>> = {
  hoje_confirmar: hojeConfirmar,
  hoje_atendido: hojeAtendido,
  hoje_horario_vago_amanha: hojeHorarioVagoAmanha,
  recuperar_quem_primeiro: recuperarQuemPrimeiro,
  recuperar_total_parado: recuperarTotalParado,
  recuperar_sumidos_60: recuperarSumidos60,
  caixa_faturamento_mes: caixaFaturamentoMes,
  caixa_lucro_mes: caixaSobrouMes,
  orcamentos_sem_resposta: orcamentosSemResposta,
}

export async function respostaRapida(id: IdRespostaRapida, ctx: ContextoRapido): Promise<RespostaRapida> {
  return RESPOSTAS[id](ctx)
}
