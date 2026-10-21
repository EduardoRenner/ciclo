import { aparecerNaBusca, resultadoDaBusca } from '@/core/busca/negocios'
import { SERVICO_DE_VOLTA } from '@/core/cycle/servico-padrao-da-base'
import { ehDemonstracao } from '@/core/tenants/demonstracao'
import { urlDaVitrine } from '@/core/text/vitrine'
import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { negocioEstaPausado } from '@/server/services/planos'
import { lerSite } from '@/server/services/site'

export type ResultadoDeBusca = {
  slug: string
  nome: string
  logoUrl: string | null
  endereco: string | null
  servico: string
  aPartirDeCents: number
}

/** Teto de negócios lidos por busca. Acima disso a busca precisa ir para o banco (índice de texto). */
const TETO_DE_NEGOCIOS = 500
const TETO_DE_RESULTADOS = 30

/**
 * docs/114 L-06: quem a cliente acha procurando serviço e cidade/bairro. Lê sem sessão (página
 * pública), só colunas que a página do negócio já mostra, e a decisão de quem aparece e do "a partir
 * de" mora em `core/busca/negocios.ts`. A "próxima data livre" do pedido ficou de fora: custa uma
 * consulta de disponibilidade por negócio listado.
 */
export async function buscarNegocios(busca: { termo: string; cidade: string }): Promise<ResultadoDeBusca[]> {
  return withNovoTenant(async (svc) => {
    const { data, error } = await svc
      .from('tenants')
      .select(
        'slug, name, address, plan, settings, professions ( nome, sinonimos ), services!services_tenant_id_fkey ( name, price_cents, cycle_days, canonical_key, active, bookable_online, deleted_at ), business_hours!business_hours_tenant_id_fkey ( id )',
      )
      .is('deleted_at', null)
      .order('name')
      .limit(TETO_DE_NEGOCIOS)
    if (error) throw new AppError('INTERNAL', { cause: error })

    const resultados: ResultadoDeBusca[] = []
    for (const t of data ?? []) {
      const settings = (t.settings ?? {}) as Record<string, unknown>
      const servicos = (t.services ?? [])
        .filter((s) => s.active && s.bookable_online && !s.deleted_at)
        .map((s) => ({ nome: s.name, precoCents: s.price_cents, ritmoDias: s.cycle_days, deVolta: s.canonical_key != null && SERVICO_DE_VOLTA.has(s.canonical_key) }))
      const visivel = aparecerNaBusca({
        desligado: settings.search_visible === false,
        servicosOnline: servicos.length,
        temExpediente: (t.business_hours ?? []).length > 0,
        demonstracao: ehDemonstracao(t.slug),
        pausado: negocioEstaPausado(t.plan, t.settings),
      })
      if (!visivel) continue

      const endereco = typeof t.address === 'string' ? t.address : null
      const achado = resultadoDaBusca({ nome: t.name, endereco, profissao: t.professions, servicos }, busca)
      if (!achado) continue
      resultados.push({ slug: t.slug, nome: t.name, logoUrl: urlDaVitrine(lerSite(t.settings).logoKey), endereco, ...achado })
      if (resultados.length >= TETO_DE_RESULTADOS) break
    }
    return resultados
  })
}
