import { Temporal } from '@js-temporal/polyfill'

import { custoDoServico } from '@/core/comanda/custo-do-servico'
import { calcularComissaoItem, type BaseComissao } from '@/core/comanda/totals'
import { janelaDeCobranca, margemDoAssinante, type MargemDoAssinante } from '@/core/loyalty/margem-do-clube'
import { buscarTudoPaginado } from '@/server/db/paginar'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export type MargemDoClube = MargemDoAssinante & {
  clientId: string
  clientName: string
  planName: string
  /** A janela de cobrança corrente, para a tela dizer de que período está falando. */
  desde: string
  ate: string
}

/**
 * `docs/48` C6 — quais assinantes estão dando prejuízo AGORA.
 *
 * A visita de assinante não passa por comanda (já está paga pela mensalidade), então não há
 * `profit_cents` para ler: o custo é montado com as duas peças que o dono configurou — a comissão
 * do profissional e o material da ficha de consumo. Ver `core/loyalty/margem-do-clube.ts`.
 */
export async function margensDoClube(db: Cliente, tenantId: string, timezone: string): Promise<MargemDoClube[]> {
  const { data: assinaturas, error } = await db
    .from('client_subscriptions')
    .select('client_id, billing_day, clients(name), subscription_plans(name, price_cents, sessions_per_month)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!assinaturas || assinaturas.length === 0) return []

  const hoje = Temporal.Now.instant().toZonedDateTimeISO(timezone).toPlainDate()
  const janelas = assinaturas.map((a) => ({ ...a, janela: janelaDeCobranca(a.billing_day, hoje) }))

  /*
    Uma consulta só para todas as janelas, e o recorte de cada assinante é feito em memória. As
    janelas se sobrepõem quase inteiramente (todo mundo tem um mês), então N consultas trariam
    quase as mesmas linhas N vezes — e o filtro por cliente já é indexado.
  */
  const maisAntiga = janelas.reduce((menor, j) => (Temporal.PlainDate.compare(j.janela.inicio, menor) < 0 ? j.janela.inicio : menor), janelas[0]!.janela.inicio)
  const maisRecente = janelas.reduce((maior, j) => (Temporal.PlainDate.compare(j.janela.fim, maior) > 0 ? j.janela.fim : maior), janelas[0]!.janela.fim)

  const visitas = await buscarTudoPaginado(() =>
    db
      .from('appointments')
      .select('client_id, service_id, professional_id, price_cents, starts_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'done')
      .in('client_id', janelas.map((j) => j.client_id))
      .gte('starts_at', maisAntiga.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString())
      .lt('starts_at', maisRecente.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString())
      .order('id'),
  )

  const servicosUsados = [...new Set(visitas.map((v) => v.service_id))]
  const profissionaisUsados = [...new Set(visitas.map((v) => v.professional_id).filter((id): id is string => Boolean(id)))]

  const [fichas, vinculos, profissionais, tenant] = await Promise.all([
    servicosUsados.length > 0
      ? db.from('service_products').select('service_id, qty, products(avg_cost_cents)').eq('tenant_id', tenantId).in('service_id', servicosUsados)
      : Promise.resolve({ data: [], error: null }),
    profissionaisUsados.length > 0
      ? db.from('professional_services').select('professional_id, service_id, commission_bps').eq('tenant_id', tenantId).in('professional_id', profissionaisUsados)
      : Promise.resolve({ data: [], error: null }),
    profissionaisUsados.length > 0
      ? db.from('professionals').select('id, commission_bps').eq('tenant_id', tenantId).in('id', profissionaisUsados)
      : Promise.resolve({ data: [], error: null }),
    db.from('tenants').select('settings').eq('id', tenantId).maybeSingle(),
  ])
  if (fichas.error) throw new AppError('INTERNAL', { cause: fichas.error })
  if (vinculos.error) throw new AppError('INTERNAL', { cause: vinculos.error })
  if (profissionais.error) throw new AppError('INTERNAL', { cause: profissionais.error })

  const fichaPorServico = new Map<string, { qty: number; avgCostCents: number }[]>()
  for (const linha of fichas.data ?? []) {
    const lista = fichaPorServico.get(linha.service_id) ?? []
    lista.push({ qty: linha.qty, avgCostCents: linha.products?.avg_cost_cents ?? 0 })
    fichaPorServico.set(linha.service_id, lista)
  }

  const bpsDoVinculo = new Map((vinculos.data ?? []).filter((v) => v.commission_bps !== null).map((v) => [`${v.professional_id}:${v.service_id}`, v.commission_bps!]))
  const bpsDoProfissional = new Map((profissionais.data ?? []).map((p) => [p.id, p.commission_bps]))
  const commissionBase = (((tenant.data?.settings ?? {}) as { commission_base?: BaseComissao }).commission_base ?? 'gross') as BaseComissao

  return janelas
    .filter((a) => a.subscription_plans && a.clients)
    .map((a) => {
      const inicio = a.janela.inicio.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant()
      const fim = a.janela.fim.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant()

      const doAssinante = visitas.filter((v) => {
        if (v.client_id !== a.client_id) return false
        const quando = Temporal.Instant.from(v.starts_at)
        return Temporal.Instant.compare(quando, inicio) >= 0 && Temporal.Instant.compare(quando, fim) < 0
      })

      const custos = doAssinante.map((v) => {
        const ficha = fichaPorServico.get(v.service_id) ?? []
        const custo = custoDoServico(ficha, 1)
        const material = custo.custoCents
        const bps = v.professional_id
          ? (bpsDoVinculo.get(`${v.professional_id}:${v.service_id}`) ?? bpsDoProfissional.get(v.professional_id) ?? 0)
          : 0
        const comissao = calcularComissaoItem({ totalCents: v.price_cents, costCents: material, commissionBps: bps, commissionBase })
        /*
         * `produtosSemCusto` vinha de `custoDoServico` desde sempre e era DESCARTADO aqui — a
         * pergunta que sobrava era `ficha.length === 0`, que a ficha semeada pelo pack respondia
         * com "tem ficha" mesmo sem custo real nenhum por trás. Ver `docs/51` §2.
         */
        return { custoCents: material + comissao, materialIncerto: ficha.length === 0 || custo.produtosSemCusto > 0 }
      })

      return {
        clientId: a.client_id,
        clientName: a.clients!.name,
        planName: a.subscription_plans!.name,
        desde: a.janela.inicio.toString(),
        ate: a.janela.fim.toString(),
        ...margemDoAssinante(a.subscription_plans!.price_cents, a.subscription_plans!.sessions_per_month, custos),
      }
    })
    .sort((a, b) => a.margemCents - b.margemCents)
}
