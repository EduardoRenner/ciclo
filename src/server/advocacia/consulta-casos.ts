import { CASO_ENCERRADO, proximoPasso, type EstadoDoCaso, type ProximoPasso } from '@/core/advocacia/resumo-do-caso'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * Leitura de casos do pacote Advocacia (docs/101 T2.6), sempre com o cliente do USUÁRIO: o caso
 * sigiloso fora do alcance simplesmente não vem, e a tela mostra só a CONTAGEM dos restritos
 * (`legal_count_restricted`), nunca o título.
 */

const ESPERANDO = ['rascunho', 'pendente', 'devolvido']
const NA_FILA = ['rascunho', 'pendente', 'devolvido', 'recebido', 'em_conferencia']

export type CasoNaLista = {
  id: string
  titulo: string
  tipo: string
  estado: EstadoDoCaso
  sigiloso: boolean
  clienteId: string
  clienteNome: string
  responsavel: string | null
  responsavelId: string | null
  pendenciasAbertas: number
  proximo: ProximoPasso | null
}

type LinhaDoCaso = {
  id: string
  title: string
  kind: string
  status: string
  sensitivity: string
  client_id: string
  responsible_professional_id: string | null
  clients: { name: string } | null
  professionals: { display_name: string } | null
  legal_checklist_items: { title: string; status: string; owed_by: string; due_on: string | null }[]
  legal_deadlines: { title: string; kind: string; due_on: string; internal_due_on: string | null; status: string }[]
}

const SELECAO =
  'id, title, kind, status, sensitivity, client_id, responsible_professional_id, ' +
  // Todo embed leva o nome da chave: `legal_deadlines` e `legal_documents` também ligam caso a cliente e a
  // profissional, e o PostgREST recusa embed ambíguo (memória `segunda-fk-quebra-embed-postgrest`).
  'clients!legal_cases_client_id_tenant_id_fkey(name), professionals!legal_cases_responsible_professional_id_fkey(display_name), ' +
  'legal_checklist_items!legal_checklist_items_case_id_tenant_id_fkey(title, status, owed_by, due_on), ' +
  'legal_deadlines!legal_deadlines_case_id_tenant_id_fkey(title, kind, due_on, internal_due_on, status)'

function resumir(l: LinhaDoCaso, hoje: string): CasoNaLista {
  return {
    id: l.id,
    titulo: l.title,
    tipo: l.kind,
    estado: l.status as EstadoDoCaso,
    sigiloso: l.sensitivity === 'sigiloso',
    clienteId: l.client_id,
    clienteNome: l.clients?.name ?? 'Cliente',
    responsavel: l.professionals?.display_name ?? null,
    responsavelId: l.responsible_professional_id,
    pendenciasAbertas: l.legal_checklist_items.filter((i) => NA_FILA.includes(i.status)).length,
    proximo: proximoPasso(
      l.legal_deadlines.map((d) => ({
        titulo: d.title,
        tipo: d.kind as 'fatal' | 'interno' | 'audiencia' | 'contratual',
        venceEm: d.due_on,
        internoEm: d.internal_due_on,
        aberto: d.status === 'aberto',
      })),
      l.legal_checklist_items.map((i) => ({
        titulo: i.title,
        quemDeve: i.owed_by === 'equipe' ? 'equipe' : 'cliente',
        venceEm: i.due_on,
        esperando: ESPERANDO.includes(i.status),
      })),
      hoje,
    ),
  }
}

export async function listarCasos(
  db: Cliente,
  tenantId: string,
  opcoes: { encerrados: boolean; hoje: string },
): Promise<{ casos: CasoNaLista[]; restritos: number }> {
  let consulta = db.from('legal_cases').select(SELECAO).eq('tenant_id', tenantId).is('archived_at', null)
  consulta = opcoes.encerrados
    ? consulta.in('status', CASO_ENCERRADO as EstadoDoCaso[])
    : consulta.not('status', 'in', `(${CASO_ENCERRADO.join(',')})`)
  const [{ data, error }, restritos] = await Promise.all([
    consulta.order('opened_on', { ascending: false }).limit(300),
    db.rpc('legal_count_restricted', { p_tenant: tenantId }),
  ])
  if (error) throw new AppError('INTERNAL', { cause: error })
  const casos = ((data ?? []) as unknown as LinhaDoCaso[]).map((l) => resumir(l, opcoes.hoje))
  // O que aperta primeiro sobe: atrasado, depois a data do próximo passo; sem próximo passo vai para o fim.
  casos.sort(
    (a, b) =>
      Number(b.proximo?.atrasado ?? false) - Number(a.proximo?.atrasado ?? false) ||
      (a.proximo?.ate ?? '9999').localeCompare(b.proximo?.ate ?? '9999'),
  )
  return { casos, restritos: restritos.error ? 0 : (restritos.data ?? 0) }
}

export type FichaDoCaso = CasoNaLista & {
  paraCliente: string
  notaParaCliente: string | null
  area: string
  cnj: string | null
  comarca: string | null
  abertoEm: string
  equipe: { id: string; nome: string; papel: string }[]
  prazos: { id: string; titulo: string; tipo: string; venceEm: string; horario: string | null; internoEm: string | null; estado: string; confirmado: boolean }[]
}

export async function lerCaso(db: Cliente, tenantId: string, casoId: string, hoje: string): Promise<FichaDoCaso | null> {
  const { data, error } = await db
    .from('legal_cases')
    .select(
      SELECAO +
        ', client_title, client_status_note, area, cnj_number, comarca, opened_on, ' +
        'legal_case_members!legal_case_members_case_id_tenant_id_fkey(role, professional_id, professionals!legal_case_members_professional_id_fkey(display_name))',
    )
    .eq('tenant_id', tenantId)
    .eq('id', casoId)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) return null

  type Linha = LinhaDoCaso & {
    client_title: string
    client_status_note: string | null
    area: string
    cnj_number: string | null
    comarca: string | null
    opened_on: string
    legal_case_members: { role: string; professional_id: string; professionals: { display_name: string } | null }[]
  }
  const l = data as unknown as Linha

  // A ficha precisa dos ids e da confirmação dos prazos, que a lista não usa.
  const prazos = await db
    .from('legal_deadlines')
    .select('id, title, kind, due_on, due_at, internal_due_on, status, confirmed_at')
    .eq('tenant_id', tenantId)
    .eq('case_id', casoId)
    .order('due_on')
  if (prazos.error) throw new AppError('INTERNAL', { cause: prazos.error })

  return {
    ...resumir(l, hoje),
    paraCliente: l.client_title,
    notaParaCliente: l.client_status_note,
    area: l.area,
    cnj: l.cnj_number,
    comarca: l.comarca,
    abertoEm: l.opened_on,
    equipe: l.legal_case_members.map((m) => ({ id: m.professional_id, nome: m.professionals?.display_name ?? 'Pessoa da equipe', papel: m.role })),
    prazos: (prazos.data ?? []).map((p) => ({
      id: p.id,
      titulo: p.title,
      tipo: p.kind,
      venceEm: p.due_on,
      horario: p.due_at,
      internoEm: p.internal_due_on,
      estado: p.status,
      confirmado: p.confirmed_at !== null,
    })),
  }
}
