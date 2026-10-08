import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import { gerarPendencias, TIPOS_DE_CASO, transicionar, type AcaoNaPendencia, type ModeloDeChecklist, type PassoDoModelo } from '@/core/advocacia/checklist'
import { AREAS_DO_CASO, decidirMudancaDeSigilo, ESTADOS_DO_CASO, podeMudarEstado, sigiloInicial, type EstadoDoCaso, type PapelNoEscritorio } from '@/core/advocacia/casos'
import { hojeNoFuso } from '@/core/advocacia/datas'
import { linkDoWhatsApp } from '@/core/advocacia/fila-de-pendencias'
import { montarMensagem } from '@/core/advocacia/mensagens'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * Casos e pendências do pacote Advocacia (docs/101 T2.1/T2.2). Tudo pelo cliente do USUÁRIO: a RLS
 * decide o sigilo (`legal_can_access_case`), e esta camada só monta as linhas a partir das regras de
 * `core/advocacia/`. `service_role` não entra aqui.
 */


export const EsquemaCriarCaso = z
  .object({
    clientId: z.uuid(),
    kind: z.enum(TIPOS_DE_CASO),
    area: z.enum(AREAS_DO_CASO).default('outro'),
    title: z.string().trim().min(2).max(200),
    clientTitle: z.string().trim().min(2).max(200),
    sensitivity: z.enum(['normal', 'sigiloso']).default('normal'),
    // só dígitos: a captura do DJEN vincula pela igualdade exata (`legal_intimacoes_gravar`)
    cnjNumber: z
      .string()
      .transform((s) => s.replace(/\D/g, ''))
      .pipe(z.string().regex(/^\d{20}$/, 'O número do processo tem 20 dígitos.'))
      .optional(),
    rito: z.enum(['civel', 'trabalhista', 'jec', 'penal']).optional(),
    comarca: z.string().trim().min(2).max(80).optional(),
    responsibleProfessionalId: z.uuid().optional(),
    gerarChecklist: z.boolean().default(true),
  })
  .strict()

export type EntradaCriarCaso = z.infer<typeof EsquemaCriarCaso>

/** O modelo que vale para o tipo de caso: o do escritório (versão mais alta) ou, sem ele, o da plataforma. */
async function modeloDoTipo(db: Cliente, tenantId: string, kind: EntradaCriarCaso['kind']): Promise<(ModeloDeChecklist & { ids: string[] }) | null> {
  const { data: modelos, error } = await db
    .from('legal_checklist_templates')
    .select('id, tenant_id, version')
    .eq('case_kind', kind)
    .eq('active', true)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order('version', { ascending: false })
  if (error) throw new AppError('INTERNAL', { cause: error })
  const escolhido = (modelos ?? []).find((m) => m.tenant_id === tenantId) ?? (modelos ?? []).find((m) => m.tenant_id === null)
  if (!escolhido) return null

  const { data: itens, error: erroItens } = await db
    .from('legal_checklist_template_items')
    .select('id, position, title, kind, owed_by, offset_business_days, urgency, expected_category')
    .eq('template_id', escolhido.id)
    .order('position')
  if (erroItens) throw new AppError('INTERNAL', { cause: erroItens })

  return {
    tipoDeCaso: kind,
    versao: escolhido.version,
    ids: (itens ?? []).map((i) => i.id),
    passos: (itens ?? []).map(
      (i): PassoDoModelo => ({
        titulo: i.title,
        tipo: i.kind as PassoDoModelo['tipo'],
        quemDeve: i.owed_by as PassoDoModelo['quemDeve'],
        diasUteis: i.offset_business_days,
        urgencia: i.urgency as NonNullable<PassoDoModelo['urgencia']>,
        ...(i.expected_category ? { categoria: i.expected_category } : {}),
      }),
    ),
  }
}

/** Dias que não contam para as datas do checklist: feriados da plataforma e do escritório. */
async function diasNaoContaveis(db: Cliente, tenantId: string): Promise<{ data: string; motivo: string }[]> {
  const { data, error } = await db
    .from('legal_holidays')
    .select('day, name')
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .is('tribunal', null)
    .is('comarca', null)
  // Erro aqui não vira lista vazia: datas sem feriado sairiam erradas e ninguém saberia por quê.
  if (error) throw new AppError('INTERNAL', { cause: error })
  return (data ?? []).map((f) => ({ data: f.day, motivo: f.name }))
}

export type CasoCriado = { id: string; pendencias: number }

export async function criarCaso(
  db: Cliente,
  tenantId: string,
  opcoes: { timezone: string; agora: Date; criadoPorEstagio: boolean },
  entrada: EntradaCriarCaso,
): Promise<CasoCriado> {
  const id = randomUUID()
  const modelo = entrada.gerarChecklist ? await modeloDoTipo(db, tenantId, entrada.kind) : null

  // Sem `.select()` de propósito: o caso SIGILOSO só fica visível para quem o criou DEPOIS que o
  // gatilho o põe na equipe, e o `returning` do mesmo comando ainda não enxerga isso (0105).
  const { error } = await db.from('legal_cases').insert({
    id,
    tenant_id: tenantId,
    client_id: entrada.clientId,
    kind: entrada.kind,
    area: entrada.area,
    title: entrada.title,
    client_title: entrada.clientTitle,
    sensitivity: sigiloInicial(entrada.area, entrada.sensitivity),
    cnj_number: entrada.cnjNumber ?? null,
    rito: entrada.rito ?? null,
    comarca: entrada.comarca ?? null,
    responsible_professional_id: entrada.responsibleProfessionalId ?? null,
    checklist_template_version: modelo?.versao ?? null,
    opened_on: hojeNoFuso(opcoes.timezone, opcoes.agora),
  })
  if (error) {
    // 23503 = FK: o cliente não existe neste escritório (a FK composta por tenant recusa o de outro)
    if (error.code === '23503') throw AppError.validacao({ clientId: 'Esse cliente não está na lista do escritório.' })
    throw new AppError('INTERNAL', { cause: error })
  }

  if (!modelo || modelo.passos.length === 0) return { id, pendencias: 0 }

  const pendencias = gerarPendencias(modelo, hojeNoFuso(opcoes.timezone, opcoes.agora), await diasNaoContaveis(db, tenantId), {
    criadoPorEstagio: opcoes.criadoPorEstagio,
  })
  const { error: erroItens } = await db.from('legal_checklist_items').insert(
    pendencias.map((p, i) => ({
      tenant_id: tenantId,
      case_id: id,
      template_item_id: modelo.ids[i] ?? null,
      position: p.posicao,
      title: p.titulo,
      kind: p.tipo,
      owed_by: p.quemDeve,
      urgency: p.urgencia,
      expected_category: p.categoria,
      due_on: p.venceEm,
      status: p.estado,
      rodada: p.rodada,
    })),
  )
  if (erroItens) throw new AppError('INTERNAL', { cause: erroItens })
  return { id, pendencias: pendencias.length }
}

// ---------------------------------------------------------------------------------------------
// Pendências
// ---------------------------------------------------------------------------------------------

export const EsquemaAcaoNaPendencia = z
  .object({
    acao: z.enum(['aprovar', 'receber', 'conferir', 'concluir', 'devolver', 'cancelar']),
    motivo: z.string().trim().max(500).optional(),
    rowVersion: z.number().int().min(1),
  })
  .strict()

export type EntradaAcaoNaPendencia = z.infer<typeof EsquemaAcaoNaPendencia>

export async function agirNaPendencia(
  db: Cliente,
  tenantId: string,
  itemId: string,
  quem: { userId: string; timezone: string; agora: Date },
  entrada: EntradaAcaoNaPendencia,
): Promise<{ id: string; estado: string; rodada: number }> {
  const { data: atual, error } = await db
    .from('legal_checklist_items')
    .select('id, status, rodada, row_version')
    .eq('tenant_id', tenantId)
    .eq('id', itemId)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  // Não existe OU é de caso sigiloso que esta pessoa não enxerga: a mesma resposta, para a diferença
  // não virar um verificador de casos sigilosos.
  if (!atual) throw new AppError('NOT_FOUND', { message: 'Essa pendência não está mais disponível.' })
  if (atual.row_version !== entrada.rowVersion) {
    throw new AppError('CONFLICT', { message: 'Alguém alterou esta pendência. Recarregue para ver a versão atual.' })
  }

  const r = transicionar({ estado: atual.status as Parameters<typeof transicionar>[0]['estado'], rodada: atual.rodada }, entrada.acao as AcaoNaPendencia, entrada.motivo ?? null)
  if (!r.ok) throw AppError.validacao({ acao: r.motivo })

  const motivo = entrada.motivo?.trim() || null
  const mudanca = {
    status: r.estado,
    rodada: r.rodada,
    row_version: atual.row_version + 1,
    ...(entrada.acao === 'devolver' ? { returned_reason: motivo } : {}),
    ...(entrada.acao === 'cancelar' ? { cancel_reason: motivo } : {}),
    ...(entrada.acao === 'aprovar' ? { approved_by: quem.userId, approved_at: quem.agora.toISOString() } : {}),
    // rodada nova recomeça a escada de lembretes do zero (core/advocacia/checklist.ts)
    ...(r.zerarLembretes ? { reminders_sent: [], call_task_created: false, rodada_desde: hojeNoFuso(quem.timezone, quem.agora) } : {}),
  }
  const { data: gravado, error: erroGravar } = await db
    .from('legal_checklist_items')
    .update(mudanca)
    .eq('tenant_id', tenantId)
    .eq('id', itemId)
    .eq('row_version', atual.row_version)
    .select('id, status, rodada')
  // LGL01 é o gatilho do rascunho (0110): estágio não aprova o que gerou. A frase vem do banco.
  if (erroGravar?.code === 'LGL01') throw new AppError('FORBIDDEN', { message: erroGravar.message, cause: erroGravar })
  if (erroGravar) throw new AppError('INTERNAL', { cause: erroGravar })
  // UPDATE de zero linhas não é erro no PostgREST: aqui é a corrida que o `row_version` existe para pegar.
  if (!gravado || gravado.length === 0) {
    throw new AppError('CONFLICT', { message: 'Alguém alterou esta pendência. Recarregue para ver a versão atual.' })
  }
  return { id: gravado[0]!.id, estado: gravado[0]!.status, rodada: gravado[0]!.rodada }
}

// ---------------------------------------------------------------------------------------------
// Estado e sigilo do caso
// ---------------------------------------------------------------------------------------------

export const EsquemaMudarCaso = z
  .object({
    estado: z.enum(ESTADOS_DO_CASO).optional(),
    // a frase ao cliente (anexo 04 §4.4): vira `client_status_note` e a mensagem pronta de andamento
    notaParaCliente: z.string().trim().min(2).max(300).optional(),
    sigilo: z.enum(['normal', 'sigiloso']).optional(),
    motivoDoSigilo: z.string().trim().max(300).optional(),
    rowVersion: z.number().int().min(1),
  })
  .strict()
  .refine((e) => e.estado !== undefined || e.notaParaCliente !== undefined || e.sigilo !== undefined, 'Nada para mudar.')

/**
 * Muda estado, frase ao cliente e sigilo do caso, com concorrência por `row_version`. As regras são de
 * `core/advocacia/casos.ts` (transições, quem tira sigilo); o banco repete a do sigilo no gatilho. A
 * mensagem de andamento volta pronta (o texto passa por `montarMensagem`, que recusa número de processo,
 * valor, CPF e CNPJ): nada é enviado daqui.
 */
export async function mudarCaso(
  db: Cliente,
  tenantId: string,
  casoId: string,
  quem: { papel: PapelNoEscritorio; escritorio: string; hoje: string },
  e: z.infer<typeof EsquemaMudarCaso>,
): Promise<{ estado: string; mensagem: { texto: string; link: string } | { erro: string } | null }> {
  const { data: atual, error } = await db
    .from('legal_cases')
    .select('status, area, sensitivity, row_version, client_title, clients!legal_cases_client_id_tenant_id_fkey(name, phone_e164)')
    .eq('tenant_id', tenantId)
    .eq('id', casoId)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!atual) throw new AppError('NOT_FOUND', { message: 'Esse caso não está mais disponível.' })
  if (atual.row_version !== e.rowVersion) throw new AppError('CONFLICT', { message: 'Alguém alterou este caso. Recarregue para ver a versão atual.' })

  const estadoAtual = atual.status as EstadoDoCaso
  if (e.estado && e.estado !== estadoAtual && !podeMudarEstado(estadoAtual, e.estado)) {
    throw AppError.validacao({ estado: 'Este caso não pode ir para esse estado agora.' })
  }
  if (e.sigilo) {
    const d = decidirMudancaDeSigilo({ area: atual.area, sigilo: atual.sensitivity as 'normal' | 'sigiloso' }, e.sigilo, quem.papel, e.motivoDoSigilo ?? null)
    if (!d.ok) throw AppError.validacao({ sigilo: d.motivo })
  }

  const encerrando = e.estado === 'concluido' || e.estado === 'arquivado'
  const reabrindo = e.estado !== undefined && !encerrando && (estadoAtual === 'concluido' || estadoAtual === 'arquivado')
  const { data: gravado, error: erroGravar } = await db
    .from('legal_cases')
    .update({
      ...(e.estado ? { status: e.estado } : {}),
      ...(encerrando ? { closed_on: quem.hoje } : {}),
      ...(reabrindo ? { closed_on: null } : {}),
      ...(e.notaParaCliente !== undefined ? { client_status_note: e.notaParaCliente } : {}),
      ...(e.sigilo ? { sensitivity: e.sigilo, sensitivity_reason: e.motivoDoSigilo || null } : {}),
      row_version: atual.row_version + 1,
    })
    .eq('tenant_id', tenantId)
    .eq('id', casoId)
    .eq('row_version', atual.row_version)
    .select('status')
  if (erroGravar) throw new AppError('INTERNAL', { cause: erroGravar })
  if (!gravado || gravado.length === 0) throw new AppError('CONFLICT', { message: 'Alguém alterou este caso. Recarregue para ver a versão atual.' })

  let mensagem: { texto: string; link: string } | { erro: string } | null = null
  if (e.notaParaCliente) {
    const cliente = atual.clients as unknown as { name: string; phone_e164: string | null } | null
    const m = montarMensagem({
      tipo: 'andamento',
      primeiroNome: cliente?.name.trim().split(/\s+/u)[0] ?? null,
      escritorio: quem.escritorio,
      casoParaCliente: atual.client_title,
      frase: e.notaParaCliente,
    })
    mensagem = m.ok ? { texto: m.texto, link: linkDoWhatsApp(cliente?.phone_e164 ?? null, m.texto) } : { erro: m.motivo }
  }
  return { estado: gravado[0]!.status, mensagem }
}
