import { Temporal } from '@js-temporal/polyfill'

import type { ModuloKey } from '@/core/billing/planos'
import { dinheiro } from '@/lib/formato'
import { listarAgendaDoDia } from '@/server/services/agendamentos'
import { resumoDeHoje } from '@/server/services/resumo-hoje'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { resumoMensal } from '@/server/services/caixa'
import { listarOrcamentos } from '@/server/services/orcamentos'
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

/*
  DIZ "ATENDIDO", E NÃO "FATUROU". `resumoDeHoje` devolve a soma de `price_cents` dos atendimentos
  concluídos — preço de TABELA. Não enxerga desconto dado na comanda, item extra lançado nem
  gorjeta. Num dia com desconto, esse número é MAIOR do que a pessoa recebeu.

  A tela `/admin/hoje` foi corrigida em 31/08 pelo mesmo motivo ("Faturado hoje" virou "Atendido
  hoje", com "Ver o caixa" ao lado). Aqui a frase dizia "Você já faturou R$ X hoje" — a mesma
  mentira, em oração afirmativa, respondendo a uma pergunta direta. É pior que o rótulo: ninguém
  confere uma frase.

  O número do dinheiro que ENTROU mora no caixa (`fechamentoDiario`), e ele é do módulo `register`,
  que é pago. Trocar a fonte tiraria esta resposta de quem está no Grátis — então a saída é a
  mesma da tela: dizer o número certo com o nome certo, e apontar onde está o outro.
*/
async function hojeAtendido(ctx: ContextoRapido): Promise<RespostaRapida> {
  const resumo = await resumoDeHoje(ctx.db, ctx.tenantId, ctx.timezone)
  return {
    resposta:
      `Você já atendeu ${dinheiro.format(resumo.revenueTodayCents / 100)} hoje, somando o preço de ` +
      'tabela dos atendimentos concluídos. O que entrou de verdade, já com desconto e gorjeta, está no caixa.',
    ferramentasUsadas: ['resumo_de_hoje'],
  }
}

async function hojeHorarioVagoAmanha(ctx: ContextoRapido): Promise<RespostaRapida> {
  const hoje = Temporal.Now.instant().toZonedDateTimeISO(ctx.timezone).toPlainDate()
  const amanha = hoje.add({ days: 1 })
  const resumo = await listarAgendaDoDia(ctx.db, ctx.tenantId, amanha.toString(), ctx.timezone)
  const dataFmt = formatarDataCurta(amanha)
  const ocupacaoPct = Math.round(resumo.occupancyRate * 100)

  /*
    A checagem de expediente vem ANTES do dia vazio, e essa ordem é o conserto de 2026-09-09.

    O conserto de 30/08 tratou o dia sem expediente que TEM agendamentos e deixou o irmão dele
    passar: com zero agendamentos, a resposta caía no ramo de baixo e dizia "sua agenda está
    totalmente livre" — num domingo em que o salão nem abre. E o dia fechado com zero marcações é
    justamente o caso MAIS comum dos dois.

    "Livre" convida a marcar; "fechada" manda cadastrar o expediente. A diferença é o que a pessoa
    faz depois de ler.
  */
  if (!resumo.temExpediente) {
    if (resumo.appointments.length === 0) {
      return {
        resposta: `Amanhã (${dataFmt}) não há expediente cadastrado: a agenda está fechada, não vazia. Dá para cadastrar o horário em Config, Horários.`,
        ferramentasUsadas: ['ocupacao_do_dia'],
      }
    }
    return {
      resposta: `Sim, amanhã (${dataFmt}) você tem horário vago: ${resumo.appointments.length} agendamento(s) marcado(s). Não há expediente cadastrado para esse dia.`,
      ferramentasUsadas: ['ocupacao_do_dia'],
    }
  }
  // Agora sim: expediente cadastrado E nenhuma marcação. Aqui "livre" é verdade.
  if (resumo.appointments.length === 0) {
    return { resposta: `Sim, amanhã (${dataFmt}) sua agenda está totalmente livre.`, ferramentasUsadas: ['ocupacao_do_dia'] }
  }

  if (ocupacaoPct >= 100) {
    return { resposta: `Não, amanhã (${dataFmt}) sua agenda já está cheia (100% ocupada).`, ferramentasUsadas: ['ocupacao_do_dia'] }
  }
  return {
    resposta: `Sim, amanhã (${dataFmt}) você tem horário vago: ${resumo.appointments.length} agendamento(s) marcado(s), ${ocupacaoPct}% de ocupação.`,
    ferramentasUsadas: ['ocupacao_do_dia'],
  }
}

async function recuperarQuemPrimeiro(ctx: ContextoRapido): Promise<RespostaRapida> {
  const lista = await listarParaRecuperar(ctx.db, ctx.tenantId, { limit: 1 })
  const primeiro = lista.items[0]
  if (!primeiro) {
    return { resposta: 'Ninguém precisa ser chamado agora, a base inteira está em dia.', ferramentasUsadas: ['clientes_para_recuperar'] }
  }
  return {
    resposta: `Chame primeiro ${primeiro.name}: ${dinheiro.format(primeiro.valueCents / 100)} em risco, ${primeiro.lateDays} dia(s) sem voltar.`,
    ferramentasUsadas: ['clientes_para_recuperar'],
  }
}

/*
  NÃO diz "você TEM R$ X parado", e as duas palavras importam.

  `totalValueCents` é `preço do serviço × chance de a pessoa voltar` (§5.3) — uma ESTIMATIVA. A
  tela de Recuperar já tinha passado por isso: o rótulo era "Valor parado", ninguém entendia o
  número (numa barbearia de corte a R$ 45 a linha aparecia como R$ 5,40), e ele virou "Dá para
  recuperar", com a frase "estimativa, não promessa" logo abaixo.

  Aqui a resposta ainda dizia a versão antiga, e em oração afirmativa: "você TEM" promete posse de
  um dinheiro que não está parado em lugar nenhum. É a mesma classe do "faturou" — número honesto
  com nome que promete demais, na superfície que fala em frases.

  A frase espelha a tela: o mesmo verbo, a mesma ressalva.
*/
async function recuperarTotalParado(ctx: ContextoRapido): Promise<RespostaRapida> {
  const lista = await listarParaRecuperar(ctx.db, ctx.tenantId, { limit: 1 })
  if (lista.count === 0) {
    return { resposta: 'Ninguém para recuperar agora, toda a base está em dia.', ferramentasUsadas: ['clientes_para_recuperar'] }
  }
  const quantas = lista.count === 1 ? '1 pessoa' : `${lista.count} pessoas`
  return {
    resposta:
      `Dá para recuperar cerca de ${dinheiro.format(lista.totalValueCents / 100)}, de ${quantas} que ` +
      'estão atrasadas. É estimativa, não promessa: o preço do serviço de cada uma, multiplicado pela chance de voltar.',
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
    // "cliente(s) sumida(s)" supunha que quem sumiu é mulher — o CICLO atende barbearia, e a frase
    // é lida pelo dono. `docs/20` §C.4: reescrever sem gênero, não alternar.
    resposta: `${sumidos.length === 1 ? '1 pessoa sumiu' : `${sumidos.length} pessoas sumiram`} há mais de 60 dias: ${nomes}.`,
    ferramentasUsadas: ['clientes_para_recuperar'],
  }
}

async function caixaFaturamentoMes(ctx: ContextoRapido): Promise<RespostaRapida> {
  const resumo = await resumoMensal(ctx.db, ctx.tenantId, ctx.timezone, mesCorrente(ctx.timezone))
  return { resposta: `Você faturou ${dinheiro.format(resumo.revenueCents / 100)} neste mês, até agora.`, ferramentasUsadas: ['faturamento_do_periodo'] }
}

/*
  DIZ "SOBROU", NÃO "LUCRO", e a ressalva da maquininha é CONDICIONAL.

  Dois problemas na frase anterior, e o segundo era uma afirmação falsa:

  1. `profitCents` soma o `profit_cents` congelado de cada comanda — receita menos material, taxa e
     comissão. **Não desconta o custo fixo** (aluguel, hora de cadeira). É margem de contribuição, e
     a tela do caixa chama de "Sobrou" exatamente por isso. "Lucro" promete uma conta que não foi
     feita.
  2. Ela afirmava "já descontado material, taxa e comissão" SEMPRE — e a taxa só entra se o dono
     tiver dito quanto a maquininha cobra. A tela sabe disso e mostra um aviso ("o Sobrou ainda não
     desconta a maquininha: você não disse quanto ela cobra") quando `taxas.respondida` é falso.
     A resposta dizia que descontou algo que pode não ter descontado.

  A frase espelha a tela nas duas coisas, e usa a MESMA fonte da condição
  (`lerTaxasDoTenant().respondida`), para as duas não divergirem depois.
*/
async function caixaSobrouMes(ctx: ContextoRapido): Promise<RespostaRapida> {
  const [resumo, taxas] = await Promise.all([
    resumoMensal(ctx.db, ctx.tenantId, ctx.timezone, mesCorrente(ctx.timezone)),
    lerTaxasDoTenant(ctx.db, ctx.tenantId),
  ])
  const descontado = taxas.respondida ? 'material, taxa da maquininha e comissão' : 'material e comissão'
  const ressalva = taxas.respondida ? '' : ' A maquininha ainda não entra na conta: você não disse quanto ela cobra.'
  return {
    resposta:
      `Sobrou ${dinheiro.format(resumo.profitCents / 100)} neste mês, já descontado ${descontado}. ` +
      `Ainda não desconta o custo fixo.${ressalva}`,
    ferramentasUsadas: ['faturamento_do_periodo'],
  }
}

async function orcamentosSemResposta(ctx: ContextoRapido): Promise<RespostaRapida> {
  const todos = await listarOrcamentos(ctx.db, ctx.tenantId)
  const parados = todos.filter((o) => o.status === 'sent')
  if (parados.length === 0) {
    return { resposta: 'Nenhum orçamento parado, todos já tiveram resposta.', ferramentasUsadas: ['orcamentos_parados'] }
  }
  const nomes = truncarLista(parados.map((o) => o.clientName))
  return {
    resposta: `${parados.length} orçamento(s) sem resposta: ${nomes}.`,
    ferramentasUsadas: ['orcamentos_parados'],
  }
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
