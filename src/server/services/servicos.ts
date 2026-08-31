import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Colunas devolvidas pela API. `cost_cents` fica de fora: é estimativa interna, não vai para a UI de catálogo. */
const COLUNAS =
  'id, name, description, duration_min, buffer_before_min, buffer_after_min, price_cents, pricing_model, hourly_rate_cents, half_day_price_cents, cycle_days, deposit_bps, deposit_min_cents, parallel_capacity, requires_anamnesis, bookable_online, active, position, category_id, image_key'

/**
 * Limites copiados dos `check` da 0001 — validar aqui devolve erro de campo em
 * pt-BR em vez de deixar estourar como violação de constraint no banco.
 */
const EsquemaServicoBase = z.object({
  name: z.string().trim().min(2, 'Dê um nome ao serviço.').max(120, 'Nome muito longo.'),
  description: z.string().trim().max(500, 'Descrição muito longa.').nullish(),
  durationMin: z
    .int('Informe a duração em minutos.')
    .min(5, 'A duração mínima é 5 minutos.')
    .max(720, 'A duração máxima é 12 horas.'),
  bufferBeforeMin: z.int().min(0, 'O preparo não pode ser negativo.').max(240, 'Preparo muito longo.').default(0),
  bufferAfterMin: z.int().min(0, 'A limpeza não pode ser negativa.').max(240, 'Limpeza muito longa.').default(0),
  priceCents: z.int('Informe o preço.').min(0, 'O preço não pode ser negativo.'),
  // G5 (docs/09-PLATAFORMA.md): price_cents sempre foi tratado como preço fechado — pricingModel
  // diz o que ele significa (fixed = total; hourly = por hora; visit_hourly = taxa de visita,
  // com hourlyRateCents à parte; daily = diária, com halfDayPriceCents opcional).
  pricingModel: z.enum(['fixed', 'hourly', 'visit_hourly', 'daily']).default('fixed'),
  hourlyRateCents: z.int().min(0, 'O valor da hora não pode ser negativo.').nullish(),
  halfDayPriceCents: z.int().min(0, 'A meia diária não pode ser negativa.').nullish(),
  cycleDays: z
    .int()
    .min(1, 'O ciclo mínimo é 1 dia.')
    .max(365, 'O ciclo máximo é 365 dias.')
    .default(21),
  depositBps: z.int().min(0).max(10000, 'O sinal não pode passar de 100%.').default(0),
  depositMinCents: z.int().min(0, 'O sinal mínimo não pode ser negativo.').default(0),
  parallelCapacity: z.int().min(1, 'A capacidade mínima é 1.').max(20, 'Capacidade muito alta.').default(1),
  requiresAnamnesis: z.boolean().default(false),
  bookableOnline: z.boolean().default(true),
  categoryId: z.uuid('Categoria inválida.').nullish(),
})

/** Mesma regra de `services_visit_hourly_tem_taxa` (migration 0029), checada antes do banco pra devolver erro de campo em pt-BR. */
export const EsquemaServico = EsquemaServicoBase.refine((d) => d.pricingModel !== 'visit_hourly' || d.hourlyRateCents != null, {
  message: 'Informe o valor da hora.',
  path: ['hourlyRateCents'],
})

/** No PATCH todo campo é opcional, mas o que vier ainda passa pelas mesmas regras. */
export const EsquemaServicoParcial = EsquemaServicoBase.partial()

export const EsquemaReordenar = z.object({
  // A UI manda a lista inteira na ordem nova. Mandar só o que mudou obrigaria
  // o servidor a recalcular vizinhos, e é aí que a ordem embaralha.
  ids: z.array(z.uuid()).min(1, 'Envie a lista de serviços na ordem nova.').max(200),
})

type Entrada = z.infer<typeof EsquemaServico>
type EntradaParcial = z.infer<typeof EsquemaServicoParcial>
type Cliente = SupabaseClient<Database>

/** Traduz o índice único `services_tenant_name_uniq` (0003) em erro de campo. */
function traduzirErro(erro: { code?: string }): never {
  if (erro.code === '23505') {
    throw AppError.validacao({ name: 'Já existe um serviço com esse nome.' })
  }
  throw new AppError('INTERNAL', { cause: erro })
}

type ColunasServico = Database['public']['Tables']['services']['Update']

function paraColunas(entrada: EntradaParcial): ColunasServico {
  // Só as chaves presentes viram coluna: mandar `undefined` no PATCH apagaria
  // o valor que já estava lá.
  const colunas: ColunasServico = {}
  if (entrada.name !== undefined) colunas.name = entrada.name
  if (entrada.description !== undefined) colunas.description = entrada.description ?? null
  if (entrada.durationMin !== undefined) colunas.duration_min = entrada.durationMin
  if (entrada.bufferBeforeMin !== undefined) colunas.buffer_before_min = entrada.bufferBeforeMin
  if (entrada.bufferAfterMin !== undefined) colunas.buffer_after_min = entrada.bufferAfterMin
  if (entrada.priceCents !== undefined) colunas.price_cents = entrada.priceCents
  if (entrada.pricingModel !== undefined) colunas.pricing_model = entrada.pricingModel
  if (entrada.hourlyRateCents !== undefined) colunas.hourly_rate_cents = entrada.hourlyRateCents ?? null
  if (entrada.halfDayPriceCents !== undefined) colunas.half_day_price_cents = entrada.halfDayPriceCents ?? null
  if (entrada.cycleDays !== undefined) colunas.cycle_days = entrada.cycleDays
  if (entrada.depositBps !== undefined) colunas.deposit_bps = entrada.depositBps
  if (entrada.depositMinCents !== undefined) colunas.deposit_min_cents = entrada.depositMinCents
  if (entrada.parallelCapacity !== undefined) colunas.parallel_capacity = entrada.parallelCapacity
  if (entrada.requiresAnamnesis !== undefined) colunas.requires_anamnesis = entrada.requiresAnamnesis
  if (entrada.bookableOnline !== undefined) colunas.bookable_online = entrada.bookableOnline
  if (entrada.categoryId !== undefined) colunas.category_id = entrada.categoryId ?? null
  return colunas
}

export async function listarServicos(db: Cliente, tenantId: string, incluirArquivados = false) {
  let consulta = db
    .from('services')
    .select(COLUNAS)
    // Filtro de tenant além da RLS: defesa em profundidade da FAQ C30, e é o
    // que faz o planner usar o índice.
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (!incluirArquivados) consulta = consulta.eq('active', true)

  // `position` empata muito (o pack nasce todo com 0), então `name` desempata —
  // sem isso a lista muda de ordem entre dois carregamentos iguais.
  const { data, error } = await consulta.order('position').order('name')
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

/**
 * Mesma regra de `services_visit_hourly_tem_taxa` (0029) e do `.refine()` de `EsquemaServico` —
 * checada de novo aqui porque quem chama `criarServico` direto (fora da rota HTTP, como testes
 * de integração ou outro serviço interno) não passa pelo zod da rota, só pelo tipo em tempo de
 * compilação. Sem isso, a mensagem amigável em pt-BR nunca aparece — só a constraint crua do
 * banco, que vira um 500 sem dizer qual campo está errado.
 */
function exigirTaxaDeVisitHourly(entrada: Pick<Entrada, 'pricingModel' | 'hourlyRateCents'>): void {
  if (entrada.pricingModel === 'visit_hourly' && entrada.hourlyRateCents == null) {
    throw AppError.validacao({ hourlyRateCents: 'Informe o valor da hora.' })
  }
}

export async function criarServico(db: Cliente, tenantId: string, entrada: Entrada) {
  exigirTaxaDeVisitHourly(entrada)

  // Nasce no fim da lista: `position` = maior + 1. Sem isso todo serviço novo
  // entraria em 0 e brigaria com os do pack.
  const { data: ultimo, error: erroUltimo } = await db
    .from('services')
    .select('position')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (erroUltimo) throw new AppError('INTERNAL', { cause: erroUltimo })

  const { data, error } = await db
    .from('services')
    .insert({
      tenant_id: tenantId,
      position: (ultimo?.position ?? -1) + 1,
      ...(paraColunas(entrada) as { name: string; duration_min: number; price_cents: number }),
    })
    .select(COLUNAS)
    .single()

  if (error) traduzirErro(error)
  return data
}

export async function atualizarServico(db: Cliente, tenantId: string, id: string, entrada: EntradaParcial) {
  const colunas = paraColunas(entrada)
  if (Object.keys(colunas).length === 0) throw AppError.validacao({ _corpo: 'Nada para alterar.' })

  const { data, error } = await db
    .from('services')
    .update(colunas)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select(COLUNAS)
    .maybeSingle()

  if (error) traduzirErro(error)
  if (!data) throw new AppError('NOT_FOUND', { message: 'Esse serviço não está mais no seu catálogo.' })
  return data
}

/**
 * Arquivar, não deletar (D45). O serviço aparece em agendamento e comanda
 * antigos, e `ticket_items.service_id` é `on delete restrict` — apagar de
 * verdade quebraria o histórico ou seria recusado pelo banco.
 */
export async function arquivarServico(db: Cliente, tenantId: string, id: string) {
  const { data, error } = await db
    .from('services')
    .update({ active: false })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id, active')
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Esse serviço não está mais no seu catálogo.' })
  return data
}

export async function reordenarServicos(db: Cliente, tenantId: string, ids: string[]) {
  // Confere que a lista é do próprio tenant ANTES de escrever: sem isso, um id
  // de outro estabelecimento entraria no lote e o update dele simplesmente não
  // afetaria nada, mascarando o problema como sucesso.
  const { data: existentes, error: erroExistentes } = await db
    .from('services')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .in('id', ids)
  if (erroExistentes) throw new AppError('INTERNAL', { cause: erroExistentes })

  if ((existentes?.length ?? 0) !== ids.length) {
    throw AppError.validacao({ ids: 'A lista tem serviço que não é do seu catálogo.' })
  }

  // Um update por serviço: são poucos (dezenas) e o PostgREST não faz update
  // em lote com valor diferente por linha sem uma função dedicada.
  const erros = await Promise.all(
    ids.map((id, indice) =>
      db.from('services').update({ position: indice }).eq('id', id).eq('tenant_id', tenantId),
    ),
  )
  const falhou = erros.find((r) => r.error)
  if (falhou?.error) throw new AppError('INTERNAL', { cause: falhou.error })

  return { reordenados: ids.length }
}
