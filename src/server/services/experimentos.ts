import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import {
  contarNaJanela,
  DIAS_MAXIMO,
  DIAS_MINIMO,
  janelasDoExperimento,
  lerExperimento,
  METRICAS,
  type Contagem,
  type Janela,
  type Leitura,
  type Metrica,
} from '@/core/experimentos/experimento'
import { diaNoFuso } from '@/core/tempo/dia'
import { buscarTudoPaginado } from '@/server/db/paginar'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/** Até quando no futuro dá para marcar o início — mais longe que isso, o "antes" já não é o de agora. */
const INICIO_MAXIMO_EM_DIAS = 60

export const EsquemaCriarExperimento = z.object({
  titulo: z.string().trim().min(3, 'Diga em poucas palavras o que você vai testar.').max(120),
  metrica: z.enum(METRICAS),
  weekday: z.number().int().min(0).max(6).nullable().default(null),
  startsOn: z.iso.date(),
  dias: z.number().int().min(DIAS_MINIMO).max(DIAS_MAXIMO).default(14),
})
export type EntradaExperimento = z.infer<typeof EsquemaCriarExperimento>

export type Experimento = {
  id: string
  titulo: string
  metrica: Metrica
  weekday: number | null
  startsOn: string
  dias: number
  createdAt: string
  leitura: Leitura
}

const Baseline = z.object({ atendimentos: z.number().int(), atendidoCents: z.number().int() })

/** Concluídos entre dois dias do salão (inclusive), com o DIA no fuso do salão. */
async function concluidosEntre(db: Cliente, tenantId: string, timezone: string, janela: Janela) {
  const inicio = Temporal.PlainDate.from(janela.de).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  const fim = Temporal.PlainDate.from(janela.ate).add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  /*
    Paginado: o PostgREST corta em `max_rows` e NÃO erra. Um salão movimentado passa de mil
    atendimentos em 60 dias, e o "antes" congelado sairia menor que o real — para sempre.
  */
  const linhas = await buscarTudoPaginado(() =>
    db
      .from('appointments')
      .select('starts_at, price_cents')
      .eq('tenant_id', tenantId)
      .eq('status', 'done')
      .gte('starts_at', inicio)
      .lt('starts_at', fim)
      .order('id'),
  )
  return linhas.map((a) => ({ dia: diaNoFuso(timezone, new Date(a.starts_at)), priceCents: a.price_cents }))
}

export async function criarExperimento(
  db: Cliente,
  tenantId: string,
  timezone: string,
  userId: string,
  entrada: EntradaExperimento,
  hoje: string = diaNoFuso(timezone),
): Promise<{ id: string }> {
  /*
    Começar no passado deixaria o "antes" ser escolhido DEPOIS de ver o resultado — o dono marcaria o
    início no dia que dá o número mais bonito. Mesma regra da previsão auditada: registra antes.
  */
  if (entrada.startsOn < hoje) throw AppError.validacao({ startsOn: 'O teste começa hoje ou depois.' })
  const limite = Temporal.PlainDate.from(hoje).add({ days: INICIO_MAXIMO_EM_DIAS }).toString()
  if (entrada.startsOn > limite) throw AppError.validacao({ startsOn: 'Marque o início para os próximos 60 dias.' })

  const { antes } = janelasDoExperimento(entrada.startsOn, entrada.dias)
  const baseline: Contagem & Janela = { ...antes, ...contarNaJanela(await concluidosEntre(db, tenantId, timezone, antes), antes, entrada.weekday) }

  const { data, error } = await db
    .from('experiments')
    .insert({
      tenant_id: tenantId,
      titulo: entrada.titulo,
      metrica: entrada.metrica,
      weekday: entrada.weekday,
      starts_on: entrada.startsOn,
      dias: entrada.dias,
      baseline,
      created_by: userId,
    })
    .select('id')
    .single()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return { id: data.id }
}

export async function listarExperimentos(db: Cliente, tenantId: string, timezone: string, hoje: string = diaNoFuso(timezone)): Promise<Experimento[]> {
  const { data, error } = await db
    .from('experiments')
    .select('id, titulo, metrica, weekday, starts_on, dias, baseline, created_at, canceled_at')
    .eq('tenant_id', tenantId)
    .order('starts_on', { ascending: false })
    .limit(50)
  if (error) throw new AppError('INTERNAL', { cause: error })
  const linhas = data ?? []
  if (linhas.length === 0) return []

  // Uma consulta só para os períodos de teste de todos, do começo mais antigo ao fim mais novo.
  const janelas = linhas.map((l) => janelasDoExperimento(l.starts_on, l.dias).durante)
  const de = janelas.reduce((m, j) => (j.de < m ? j.de : m), janelas[0]!.de)
  const ate = janelas.reduce((m, j) => (j.ate > m ? j.ate : m), janelas[0]!.ate)
  const concluidos = de <= hoje ? await concluidosEntre(db, tenantId, timezone, { de, ate: ate < hoje ? ate : hoje }) : []

  return linhas.map((l) => {
    const antes = Baseline.safeParse(l.baseline)
    // Baseline ilegível é defeito de gravação, não "zero": zero viraria "subiu" do nada.
    if (!antes.success) throw new AppError('INTERNAL', { message: 'Um teste está com o antes ilegível.' })
    const metrica = (METRICAS as readonly string[]).includes(l.metrica) ? (l.metrica as Metrica) : 'atendimentos'
    return {
      id: l.id,
      titulo: l.titulo,
      metrica,
      weekday: l.weekday,
      startsOn: l.starts_on,
      dias: l.dias,
      createdAt: l.created_at,
      leitura: lerExperimento({
        startsOn: l.starts_on,
        dias: l.dias,
        metrica,
        weekday: l.weekday,
        antes: antes.data,
        concluidos,
        hoje,
        cancelado: l.canceled_at !== null,
      }),
    }
  })
}

export async function cancelarExperimento(db: Cliente, tenantId: string, id: string): Promise<{ cancelado: boolean }> {
  // A guarda de ESTADO fica no WHERE (`canceled_at is null`): cancelar duas vezes não reescreve a
  // data do primeiro cancelamento. Zero linhas não é erro — distinguir "não existe" de "já estava".
  const { data, error } = await db
    .from('experiments')
    .update({ canceled_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('canceled_at', null)
    .select('id')
  if (error) throw new AppError('INTERNAL', { cause: error })
  if ((data ?? []).length > 0) return { cancelado: true }

  const { data: existe, error: erroLeitura } = await db.from('experiments').select('id').eq('tenant_id', tenantId).eq('id', id).maybeSingle()
  if (erroLeitura) throw new AppError('INTERNAL', { cause: erroLeitura })
  if (!existe) throw new AppError('NOT_FOUND', { message: 'Esse teste não está mais na sua lista.' })
  return { cancelado: false }
}
