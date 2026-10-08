import { proximoLembrete, type EstadoDaPendencia } from '@/core/advocacia/checklist'
import { addDays, diaDaSemana } from '@/core/advocacia/datas'
import { mascaraCnj } from '@/core/advocacia/intimacoes'
import { ordenarFila, type ItemFila, type ItemOrdenado } from '@/core/advocacia/prioridade'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * A fila de Hoje do pacote Advocacia (docs/101 T4.3/T4.4): prazos abertos, intimações por triar e
 * pendências, juntos numa lista ordenada por `prioridade()` (a MESMA função do LUBI, sem cópia em SQL).
 *
 * Lida com o cliente do USUÁRIO: o que é de caso sigiloso fora do alcance não vem, e a fila não precisa
 * saber que existe. O anexo 01 previa uma view `legal_work_queue`; montar aqui, com três leituras, evita
 * uma view (que precisaria de `security_invoker` e de guarda própria) para o mesmo resultado.
 */

const LIMITE = 400

/**
 * A intimação disponibilizada no dia D é publicada no dia útil seguinte: é nele que a triagem vence.
 * Aqui só o fim de semana é pulado: a data é de ORDEM na fila, não de prazo. O prazo, que considera
 * feriado, é o da sugestão (`legal_intimation_suggestions`).
 */
function diaDaTriagem(disponibilizacao: string): string {
  let d = addDays(disponibilizacao, 1)
  while (diaDaSemana(d) === 0 || diaDaSemana(d) === 6) d = addDays(d, 1)
  return d
}

export type ItemDeHoje = ItemOrdenado & { clienteNome: string | null; casoTitulo: string | null }

export async function lerFilaDeHoje(db: Cliente, tenantId: string, hoje: string): Promise<ItemDeHoje[]> {
  const [prazos, intimacoes, pendencias] = await Promise.all([
    db
      .from('legal_deadlines')
      .select(
        'id, title, kind, due_on, internal_due_on, confirmed_at, created_at, case_id, client_id, responsible_professional_id, ' +
          'clients!legal_deadlines_client_id_tenant_id_fkey(name), legal_cases!legal_deadlines_case_id_tenant_id_fkey(title, sensitivity)',
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'aberto')
      .limit(LIMITE),
    db
      .from('legal_intimations')
      .select(
        'id, tribunal, tipo, numero_processo, data_disponibilizacao, status, case_id, created_at, ' +
          'legal_cases!legal_intimations_case_id_tenant_id_fkey(title, client_id, sensitivity, responsible_professional_id, clients!legal_cases_client_id_tenant_id_fkey(name))',
      )
      .eq('tenant_id', tenantId)
      .or('status.eq.nova,and(status.eq.vinculada,triaged_by.is.null)')
      .limit(LIMITE),
    db
      .from('legal_checklist_items')
      .select(
        'id, title, status, owed_by, due_on, created_at, case_id, rodada_desde, reminders_sent, call_task_created, ' +
          'legal_cases!legal_checklist_items_case_id_tenant_id_fkey(title, client_id, sensitivity, responsible_professional_id, clients!legal_cases_client_id_tenant_id_fkey(name))',
      )
      .eq('tenant_id', tenantId)
      .in('status', ['rascunho', 'pendente', 'devolvido', 'recebido', 'em_conferencia'])
      .limit(LIMITE),
  ])
  for (const r of [prazos, intimacoes, pendencias]) if (r.error) throw new AppError('INTERNAL', { cause: r.error })

  type Caso = { title: string; client_id: string; sensitivity: string; responsible_professional_id: string | null; clients: { name: string } | null } | null
  type Prazo = {
    id: string
    title: string
    kind: string
    due_on: string
    internal_due_on: string | null
    confirmed_at: string | null
    created_at: string
    case_id: string | null
    client_id: string
    responsible_professional_id: string | null
    clients: { name: string } | null
    legal_cases: { title: string; sensitivity: string } | null
  }
  type Intimacao = { id: string; tribunal: string; tipo: string | null; numero_processo: string; data_disponibilizacao: string; status: string; case_id: string | null; created_at: string; legal_cases: Caso }
  type Pendencia = {
    id: string
    title: string
    status: string
    owed_by: string
    due_on: string | null
    created_at: string
    case_id: string
    rodada_desde: string
    reminders_sent: number[]
    call_task_created: boolean
    legal_cases: Caso
  }

  const itens: (ItemFila & { clienteNome: string | null; casoTitulo: string | null })[] = []

  for (const p of (prazos.data ?? []) as unknown as Prazo[]) {
    itens.push({
      item_key: `deadline:${p.id}`,
      source: 'deadline',
      source_id: p.id,
      account_id: p.client_id,
      matter_id: p.case_id,
      title: p.title,
      owner_kind: 'staff',
      owner_staff_id: p.responsible_professional_id,
      // o dia em que a equipe age é o interno; o fatal vai no `raw` e aparece à parte no motivo
      due_on: p.internal_due_on ?? p.due_on,
      // só o fatal leva a data fatal à parte: num contratual, "fatal 07/10" seria mentira
      raw: p.kind === 'fatal' ? { kind: p.kind, fatal_due_on: p.due_on, confirmado: p.confirmed_at !== null } : { kind: p.kind },
      sensitivity: p.legal_cases?.sensitivity ?? null,
      link: p.case_id ? `/admin/casos/${p.case_id}` : null,
      created_at: p.created_at,
      clienteNome: p.clients?.name ?? null,
      casoTitulo: p.legal_cases?.title ?? null,
    })
  }

  for (const i of (intimacoes.data ?? []) as unknown as Intimacao[]) {
    itens.push({
      item_key: `intimation:${i.id}`,
      source: 'intimation',
      source_id: i.id,
      account_id: i.legal_cases?.client_id ?? '',
      matter_id: i.case_id,
      // o motivo já diz "Intimação nova": o título leva o que identifica (tribunal e processo)
      title: `${i.tribunal} · ${mascaraCnj(i.numero_processo)}`,
      owner_kind: 'staff',
      // sem caso, ninguém é dono ainda: cai em "Sem responsável", que é onde a direção olha primeiro
      owner_staff_id: i.legal_cases?.responsible_professional_id ?? null,
      due_on: diaDaTriagem(i.data_disponibilizacao),
      raw: { disponibilizacao: i.data_disponibilizacao, vinculada: i.case_id !== null },
      sensitivity: i.legal_cases?.sensitivity ?? null,
      link: `/admin/intimacoes/${i.id}`,
      created_at: i.created_at,
      clienteNome: i.legal_cases?.clients?.name ?? null,
      casoTitulo: i.legal_cases?.title ?? null,
    })
  }

  for (const p of (pendencias.data ?? []) as unknown as Pendencia[]) {
    const doCliente = p.owed_by === 'cliente'
    const conferir = p.status === 'recebido' || p.status === 'em_conferencia'
    itens.push({
      item_key: `checklist:${p.id}`,
      source: doCliente ? 'client_action' : 'task',
      source_id: p.id,
      account_id: p.legal_cases?.client_id ?? '',
      matter_id: p.case_id,
      title: p.title,
      // recebido: a bola voltou para a equipe, que confere
      owner_kind: doCliente && !conferir ? 'client' : 'staff',
      owner_staff_id: p.legal_cases?.responsible_professional_id ?? null,
      due_on: conferir ? hoje : p.due_on,
      raw: { estado: conferir ? 'em_conferencia' : p.status, trava_prazo: false },
      sensitivity: p.legal_cases?.sensitivity ?? null,
      link: `/admin/casos/${p.case_id}`,
      created_at: p.created_at,
      clienteNome: p.legal_cases?.clients?.name ?? null,
      casoTitulo: p.legal_cases?.title ?? null,
    })
  }

  // A escada de lembretes (T2.8) vira UM item por cliente: "Cobrar Fulano" no marco, "Ligar para Fulano"
  // depois de 10 dias. O item leva à fila de Pendências, onde o toque em Cobrar marca o lembrete.
  const lembretes = new Map<string, { tipo: 'mensagem' | 'ligar'; cliente: string; responsavel: string | null; criado: string }>()
  for (const p of (pendencias.data ?? []) as unknown as Pendencia[]) {
    const clienteId = p.legal_cases?.client_id
    if (!clienteId) continue
    const passo = proximoLembrete(
      {
        estado: p.status as EstadoDaPendencia,
        quemDeve: p.owed_by === 'equipe' ? 'equipe' : 'cliente',
        rodadaDesde: p.rodada_desde,
        jaPreparados: p.reminders_sent,
        ligarJaCriado: p.call_task_created,
      },
      hoje,
    )
    if (passo.tipo === 'nada') continue
    const atual = lembretes.get(clienteId)
    if (atual?.tipo === 'ligar') continue
    lembretes.set(clienteId, {
      tipo: passo.tipo,
      cliente: p.legal_cases?.clients?.name ?? 'cliente',
      responsavel: p.legal_cases?.responsible_professional_id ?? null,
      criado: p.created_at,
    })
  }
  for (const [clienteId, l] of lembretes) {
    itens.push({
      item_key: `lembrete:${clienteId}`,
      source: l.tipo === 'ligar' ? 'task' : 'message',
      source_id: clienteId,
      account_id: clienteId,
      matter_id: null,
      title: l.tipo === 'ligar' ? `Ligar para ${l.cliente}: 10 dias sem resposta` : `Cobrar ${l.cliente} pelo WhatsApp`,
      owner_kind: 'staff',
      owner_staff_id: l.responsavel,
      due_on: hoje,
      raw: {},
      sensitivity: null,
      link: `/admin/clientes/${clienteId}`,
      created_at: l.criado,
      clienteNome: l.cliente,
      casoTitulo: null,
    })
  }

  const extras = new Map(itens.map((i) => [i.item_key, { clienteNome: i.clienteNome, casoTitulo: i.casoTitulo }]))
  return ordenarFila(itens, hoje).map((i) => ({ ...i, ...extras.get(i.item_key)! }))
}
