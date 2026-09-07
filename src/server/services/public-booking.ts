import { ouDoProfissionalOuGeral } from '@/server/db/filtro'
import { Temporal } from '@js-temporal/polyfill'
import { cache } from 'react'
import { z } from 'zod'

import { podeUsarCapacidade } from '@/core/billing/planos'
import { availableSlots, type IntervaloExpediente, type IntervaloOcupado } from '@/core/scheduling/available-slots'
import type { ModeloDePreco } from '@/core/pricing/formatar'
import { resolverVocabulario, type Vocabulario } from '@/core/text/vocabulario'
import { sinalEmCentavos } from '@/core/pricing/sinal'
import { primeiroNome } from '@/core/text/nome'
import { urlDaVitrine } from '@/core/text/vitrine'
import { withNovoTenant } from '@/server/db/with-tenant'
import { listarExpediente } from '@/server/services/expediente'
import { lerConfiguracoesAgenda } from '@/server/services/configuracoes-agenda'
import { normalizarPlano } from '@/server/services/planos'
import { lerSite } from '@/server/services/site'
import { normalizarTelefoneBR } from '@/server/services/telefone'
import { criarAgendamento } from '@/server/services/agendamentos'
import { verificarTokenIndicacao } from '@/server/services/indicacao'
import { notificarEquipe } from '@/server/services/mensageria'
import { gerarTokenReconhecimento } from '@/server/services/reconhecimento'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

// Osso — o acento neutro do app, não o roxo antigo (ver layout.tsx do slug).
const ACENTO_PADRAO = { acc: '#f0ebe3', acc2: '#fffcf7' }

/**
 * Toda leitura pública passa por `withNovoTenant` (service_role): a RLS de
 * `tenants`/`services`/`professionals` exige `has_tenant()`, que um visitante
 * anônimo nunca tem — não existe outro caminho. A disciplina fica em nunca
 * selecionar coluna a mais (regra do TICKET-027: "nunca expor clientId,
 * telefone de outra pessoa ou lista de clientes"). `settings` sai da consulta
 * mas nunca do retorno público — carrega `min_lead_time_minutes` etc., que
 * ninguém de fora precisa ver; só `lerSite()` (whitelist) chega no visitante.
 */
async function tenantPeloSlug(svc: Cliente, slug: string) {
  const { data, error } = await svc
    .from('tenants')
    /*
     * `vocab_override` e o `vocab` da profissão entram aqui, e não numa segunda consulta, porque
     * esta é a página de maior volume do produto e uma ida a mais ao banco por visita não se paga
     * por seis palavras. A junção usa a FK `tenants_profession_id_fkey`, que já existe.
     */
    .select('id, name, slug, vertical, timezone, phone, address, settings, plan, vocab_override, professions ( vocab )')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Esse endereço não existe.' })
  return data
}

export type PerfilPublico = {
  name: string
  slug: string
  /** Nicho do salão — vira o `@type` do schema.org (HairSalon, NailSalon…) nos dados estruturados. */
  vertical: string
  /** Fuso do salão — a página pública precisa dizer "hoje" no horário de quem atende, não no do servidor. */
  timezone: string
  phone: string | null
  address: string | null
  tagline: string | null
  about: string | null
  whatsapp: string | null
  instagram: string | null
  /** Endereço público já montado — `null` quando o salão não subiu imagem. */
  logoUrl: string | null
  coverUrl: string | null
  accentColor: { acc: string; acc2: string }
  /**
   * docs/18-MONETIZACAO-PLANO.md §D.3 e §G.1: o selo "Feito com CICLO" era incondicional, e
   * remove-lo passa a ser o benefício mais concreto do primeiro degrau pago.
   *
   * Isso é receita trocada por distribuição, e a troca é consciente: cada página com selo é uma
   * impressão para o próximo profissional que a vê, e é o único canal de aquisição gratuito que o
   * produto tem (§13.1 do 09-PLATAFORMA). Todo cliente que converte apaga uma peça de
   * distribuição — um laço que se autolimita conforme o negócio dá certo.
   *
   * Decidido no SERVIDOR e entregue como booleano: a página pública é HTML de visitante anônimo,
   * e mandar `plan` para o cliente seria expor o degrau comercial de cada salão para qualquer um
   * que abrisse o DevTools. Ninguém de fora precisa saber quanto o vizinho paga.
   */
  mostrarSelo: boolean
  hours: { weekday: number; opensAt: string; closesAt: string }[]
  services: {
    id: string
    name: string
    description: string | null
    durationMin: number
    priceCents: number
    pricingModel: ModeloDePreco
    hourlyRateCents: number | null
    halfDayPriceCents: number | null
    /** Quanto a cliente adianta para segurar o horário. `null` = este serviço não pede sinal. */
    depositCents: number | null
    /** Foto do serviço — endereço já montado. `null` quando o salão não subiu nenhuma. */
    imageUrl: string | null
  }[]
  professionals: { id: string; displayName: string; photoUrl: string | null }[]
  /**
   * docs/09-PLATAFORMA.md §8: a página pública promete "avaliações" desde a
   * escrita do plano e nunca entregou — `client_reviews` (TICKET das
   * inovações de CRM) só era lido no painel. Nota média sobre TODAS as
   * avaliações (não só as 5 exibidas — pedir amostra maior distorceria a
   * média pra cima ou pra baixo dependendo de qual fatia caísse no `limit`);
   * os comentários mais recentes que têm texto, porque nota sem texto não
   * ajuda quem está decidindo se agenda.
   */
  reviews: { average: number; count: number; recentes: { rating: number; comment: string; createdAt: string }[] }
  /**
   * TICKET-115 (docs/35-FOTOS-CONSENTIMENTO-PLANO.md): a galeria se enche sozinha conforme o
   * salão atende e publica — cada linha aqui já passou por consentimento `image_use` ativo NO
   * MOMENTO de publicar (`publicarNoPortfolio`) e é uma cópia própria no bucket público
   * `vitrine`, nunca o `media` privado. Vazio é o caso comum: ninguém é obrigado a publicar nada.
   */
  portfolio: string[]
  /**
   * As palavras que esta profissão usa, já resolvidas (`docs/DECISOES.md`, 2026-09-04). Um
   * psicólogo anuncia "Sessões" onde uma barbearia anuncia "Serviços". Vem resolvido do servidor
   * porque a precedência é regra de negócio, e deixar a tela decidir espalharia a mesma decisão
   * por todo componente que precisar de uma palavra.
   */
  vocabulario: Vocabulario
}

/**
 * `cache()` do React: `layout.tsx` (cor de acento), `page.tsx` (a landing) e
 * `generateMetadata` chamam esta função na mesma requisição — sem isso seriam
 * 3 idas ao banco por visita em vez de 1.
 */
export const perfilPublico = cache(async (slug: string): Promise<PerfilPublico> => {
  return withNovoTenant(async (svc) => {
    const tenant = await tenantPeloSlug(svc, slug)

    const [servicos, profissionais, horarioPadrao, todasAsNotas, comentariosRecentes, portfolio] = await Promise.all([
      svc
        .from('services')
        .select(
          'id, name, description, duration_min, price_cents, pricing_model, hourly_rate_cents, half_day_price_cents, deposit_bps, deposit_min_cents, image_key',
        )
        .eq('tenant_id', tenant.id)
        .eq('active', true)
        .eq('bookable_online', true)
        .is('deleted_at', null)
        .order('position'),
      svc
        .from('professionals')
        .select('id, display_name, photo_key')
        .eq('tenant_id', tenant.id)
        .eq('active', true)
        .eq('accepts_online', true)
        .is('deleted_at', null)
        .order('display_name'),
      listarExpediente(svc, tenant.id, null),
      // Nota média sobre TODAS as avaliações — ver comentário de `reviews` em PerfilPublico.
      svc.from('client_reviews').select('rating').eq('tenant_id', tenant.id),
      svc
        .from('client_reviews')
        .select('rating, comment, created_at')
        .eq('tenant_id', tenant.id)
        .not('comment', 'is', null)
        /*
         * `id` como desempate, e não enfeite: com `limit(5)`, empate em `created_at` muda QUAIS
         * cinco comentários aparecem a cada carregamento. Medido em 04/09 no `dom-rocha` — duas
         * avaliações que eu tinha acabado de editar não apareciam, e a lista trocava sozinha
         * entre dois `curl` seguidos. Acontece sempre que várias linhas nascem no mesmo instante,
         * que é o caso de qualquer importação ou seed.
         */
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(5),
      svc.from('portfolio_photos').select('storage_key').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
    ])
    if (servicos.error) throw new AppError('INTERNAL', { cause: servicos.error })
    if (profissionais.error) throw new AppError('INTERNAL', { cause: profissionais.error })
    if (todasAsNotas.error) throw new AppError('INTERNAL', { cause: todasAsNotas.error })
    if (comentariosRecentes.error) throw new AppError('INTERNAL', { cause: comentariosRecentes.error })
    if (portfolio.error) throw new AppError('INTERNAL', { cause: portfolio.error })

    const site = lerSite(tenant.settings)
    // docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md (T3): a cor é escolha do dono
    // (`site.accent`, editável em /admin/config/negocio), nunca mais fixa por
    // profissão — era assim que cílios/sobrancelha nasciam roxo. Sem escolha,
    // osso; o schema já garante formato `#rrggbb` antes de chegar aqui, mas o
    // `HEX.test` em `layout.tsx` é a segunda camada que nunca deixa nada além
    // de hex válido virar `style` inline.
    const acc = site.accent ?? ACENTO_PADRAO.acc

    /*
     * O `professions` da junção vem objeto quando há profissão e `null` quando não há — tenant
     * antigo, ou cadastro que pulou a escolha. `resolverVocabulario` já trata os dois como
     * ausência e cai no padrão da casa, então não há caminho em que a tela fique sem palavra.
     */
    const profissao = tenant.professions as { vocab: unknown } | null
    const vocabulario = resolverVocabulario(profissao?.vocab, tenant.vocab_override)

    return {
      name: tenant.name,
      slug: tenant.slug,
      vocabulario,
      vertical: tenant.vertical,
      timezone: tenant.timezone,
      phone: tenant.phone,
      address: typeof tenant.address === 'string' ? tenant.address : null,
      tagline: site.tagline ?? null,
      about: site.about ?? null,
      whatsapp: site.whatsapp ?? null,
      instagram: site.instagram ?? null,
      // Endereço montado aqui, uma vez, em vez de a tela concatenar — mesmo motivo do Instagram.
      // `urlDaVitrine` vive em `core/` e é puro: a página pública não pode ter caminho de import
      // até `vitrine-upload.ts`, que carrega o `sharp`.
      logoUrl: urlDaVitrine(site.logoKey),
      coverUrl: urlDaVitrine(site.coverKey),
      accentColor: { acc, acc2: ACENTO_PADRAO.acc2 === acc ? acc : misturarComBranco(acc, 0.3) },
      // `remover_selo` é capacidade do primeiro degrau pago (§D.3). `normalizarPlano` cobre a
      // janela em que o banco ainda responde os nomes anteriores à migration 0040.
      mostrarSelo: podeUsarCapacidade(
        { plano: normalizarPlano(tenant.plan), eixos: {} },
        'remover_selo',
      ).estado !== 'liberado',
      hours: horarioPadrao.map((h) => ({ weekday: h.weekday, opensAt: h.opens_at, closesAt: h.closes_at })),
      services: (servicos.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMin: s.duration_min,
        priceCents: s.price_cents,
        pricingModel: s.pricing_model as ModeloDePreco,
        hourlyRateCents: s.hourly_rate_cents,
        halfDayPriceCents: s.half_day_price_cents,
        /*
         * `deposit_bps` existe desde a 0001 e o painel já mostra o selo "Sinal X%", mas o valor
         * nunca chegava a quem agenda — ou seja, dava para configurar um sinal que a cliente
         * jamais veria. Isto NÃO cobra nada (não há meio de pagamento no produto): põe a
         * expectativa na tela antes de confirmar, que é a parte do efeito que não depende de PSP.
         */
        depositCents: sinalEmCentavos({
          precoCents: s.price_cents,
          depositBps: s.deposit_bps,
          depositMinCents: s.deposit_min_cents,
        }),
        imageUrl: urlDaVitrine(s.image_key),
      })),
      professionals: (profissionais.data ?? []).map((p) => ({ id: p.id, displayName: p.display_name, photoUrl: urlDaVitrine(p.photo_key) })),
      reviews: {
        average:
          todasAsNotas.data && todasAsNotas.data.length > 0
            ? Math.round((todasAsNotas.data.reduce((soma, r) => soma + r.rating, 0) / todasAsNotas.data.length) * 10) / 10
            : 0,
        count: todasAsNotas.data?.length ?? 0,
        recentes: (comentariosRecentes.data ?? []).map((r) => ({
          rating: r.rating,
          comment: r.comment!,
          createdAt: r.created_at,
        })),
      },
      portfolio: (portfolio.data ?? [])
        .map((p) => urlDaVitrine(p.storage_key))
        .filter((url): url is string => url !== null),
    }
  })
})

/**
 * `color-mix()` fica pro CSS no cliente (Fase 3 do plano) — aqui é só um
 * clareamento simples em JS pra ter um `acc2` plausível quando o pack não
 * define os dois tons (hoje `vertical_packs` só tem uma coluna de cor).
 */
function misturarComBranco(hex: string, fator: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return hex
  const canal = (h: string) => Math.round(parseInt(h, 16) + (255 - parseInt(h, 16)) * fator)
  const hex2 = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex2(canal(m[1]!))}${hex2(canal(m[2]!))}${hex2(canal(m[3]!))}`
}

function weekdayPg(dia: Temporal.PlainDate): number {
  return dia.dayOfWeek % 7
}

/** "quinta, 14:30" no fuso do TENANT — nunca fatiar o ISO em UTC direto (armadilha conhecida). */
function quandoLocal(startsAtIso: string, timezone: string): string {
  const zoned = Temporal.Instant.from(startsAtIso).toZonedDateTimeISO(timezone)
  const dia = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][zoned.dayOfWeek % 7]
  const hora = `${String(zoned.hour).padStart(2, '0')}:${String(zoned.minute).padStart(2, '0')}`
  return `${dia}, ${hora}`
}

export type SlotPublico = { startsAt: string; endsAt: string; professionalId: string }

/**
 * `GET .../availability`: um dia só, e se `professionalId` não vier, agrega
 * a disponibilidade de todos os profissionais que aceitam o serviço online —
 * é o "profissional? " opcional do corpo do `book` (FAQ E71-adjacente: a
 * cliente pode não ter preferência).
 */
export async function disponibilidadePublica(
  slug: string,
  serviceId: string,
  date: string,
  professionalId?: string,
): Promise<SlotPublico[]> {
  return withNovoTenant(async (svc) => {
    const tenant = await tenantPeloSlug(svc, slug)

    let consultaProfissionais = svc
      .from('professionals')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('active', true)
      .eq('accepts_online', true)
      .is('deleted_at', null)
    if (professionalId) consultaProfissionais = consultaProfissionais.eq('id', professionalId)

    /*
     * Serviço e profissionais em paralelo: os dois só dependem de `tenant`, e nenhum do outro.
     * Em série eram duas idas ao banco somadas — e a função roda longe dele (Supabase em
     * sa-east-1, Vercel no padrão `iad1`), então cada salto custa a travessia inteira.
     *
     * A ORDEM DAS CHECAGENS ABAIXO É A DE ANTES, de propósito: erro de infraestrutura do serviço,
     * depois "serviço não agendável", depois erro dos profissionais. Paralelizar muda quando as
     * consultas partem, nunca qual erro a pessoa vê.
     */
    const [resServico, resProfissionais] = await Promise.all([
      svc
        .from('services')
        .select('duration_min, parallel_capacity, buffer_before_min, buffer_after_min')
        .eq('id', serviceId)
        .eq('tenant_id', tenant.id)
        .eq('active', true)
        .eq('bookable_online', true)
        .is('deleted_at', null)
        .maybeSingle(),
      consultaProfissionais,
    ])

    const { data: servico, error: erroServico } = resServico
    if (erroServico) throw new AppError('INTERNAL', { cause: erroServico })
    if (!servico) throw AppError.validacao({ serviceId: 'Esse serviço não está disponível para agendar online.' })

    const { data: profissionais, error: erroProf } = resProfissionais
    if (erroProf) throw new AppError('INTERNAL', { cause: erroProf })

    const dia = Temporal.PlainDate.from(date)
    const config = lerConfiguracoesAgenda(tenant.settings)
    // FAQ E62: booking público nunca fura a antecedência mínima — diferente
    // do app do profissional, que pode fazer encaixe manual.
    const now = Temporal.Now.instant().toString()

    const inicioDia = dia.toZonedDateTime({ timeZone: tenant.timezone, plainTime: '00:00' }).toInstant().toString()
    const fimDia = dia.add({ days: 1 }).toZonedDateTime({ timeZone: tenant.timezone, plainTime: '00:00' }).toInstant().toString()

    /*
     * Um profissional por vez era N+1: o `Promise.all` de baixo paraleliza as TRÊS consultas
     * daquele profissional, mas o laço `for ... await` esperava cada um antes de começar o
     * próximo. Um salão com 3 profissionais pagava 3 travessias em série; com 5, cinco.
     *
     * Aqui os profissionais também vão juntos. Seguro porque nada no corpo é compartilhado: cada
     * volta só lê `tenant`/`servico`/`config` (constantes) e devolve os próprios horários — não
     * havia acumulador além do `push`, que virou o retorno. E a lista final é ordenada por
     * `startsAt` no fim de qualquer forma, então a ordem de chegada nunca importou.
     */
    const porProfissional = await Promise.all(
      (profissionais ?? []).map(async (prof) => {
        const [horarios, folgas, agendamentos] = await Promise.all([
          svc
            .from('business_hours')
            .select('professional_id, weekday, opens_at, closes_at')
            .eq('tenant_id', tenant.id)
            .eq('weekday', weekdayPg(dia))
            .or(ouDoProfissionalOuGeral('professional_id', prof.id)),
          svc
            .from('time_off')
            .select('starts_at, ends_at')
            .eq('tenant_id', tenant.id)
            .or(ouDoProfissionalOuGeral('professional_id', prof.id))
            .lt('starts_at', fimDia)
            .gt('ends_at', inicioDia),
          svc
            .from('appointments')
            .select('starts_at, ends_at')
            .eq('tenant_id', tenant.id)
            .eq('professional_id', prof.id)
            .in('status', ['pending', 'confirmed', 'arrived'])
            .lt('starts_at', fimDia)
            .gt('ends_at', inicioDia),
        ])
        if (horarios.error) throw new AppError('INTERNAL', { cause: horarios.error })
        if (folgas.error) throw new AppError('INTERNAL', { cause: folgas.error })
        if (agendamentos.error) throw new AppError('INTERNAL', { cause: agendamentos.error })

        const doProfissional = horarios.data.filter((h) => h.professional_id === prof.id)
        const doPadrao = horarios.data.filter((h) => h.professional_id === null)
        const businessHours: IntervaloExpediente[] = (doProfissional.length > 0 ? doProfissional : doPadrao).map((h) => ({
          opensAt: h.opens_at,
          closesAt: h.closes_at,
        }))
        if (businessHours.length === 0) return []

        const timeOff: IntervaloOcupado[] = (folgas.data ?? []).map((f) => ({ start: f.starts_at, end: f.ends_at }))
        const ocupados: IntervaloOcupado[] = (agendamentos.data ?? []).map((a) => ({ start: a.starts_at, end: a.ends_at }))

        const slots = availableSlots({
          date,
          timezone: tenant.timezone,
          businessHours,
          timeOff,
          appointments: ocupados,
          serviceDurationMin: servico.duration_min,
          // Achado na auditoria pré-`/admin`: vinha fixo em 0, ignorando o que o
          // serviço cadastra — o buffer só funcionava no agendamento interno, nunca
          // no site público. Agora que o formulário de serviço expõe os dois campos
          // (Fase 2), o dono vai configurar e esperar que valha aqui também.
          bufferBeforeMin: servico.buffer_before_min,
          bufferAfterMin: servico.buffer_after_min,
          slotGranularityMin: config.slotGranularityMin,
          minLeadTimeMinutes: config.minLeadTimeMinutes,
          maxAdvanceDays: config.maxAdvanceDays,
          now,
          parallelCapacity: servico.parallel_capacity,
        })

        return slots.map((s) => ({
          startsAt: s,
          endsAt: Temporal.Instant.from(s).add({ minutes: servico.duration_min }).toString(),
          professionalId: prof.id,
        }))
      }),
    )

    return porProfissional.flat().sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
  })
}

/**
 * I-4, `docs/30-INDICACAO-PLANO.md` §6.2b: o primeiro nome de quem indicou, para a moldura de
 * chegada. É prova social de par — a nova cliente lê o nome de alguém que ela conhece antes do
 * primeiro clique, que é o "encaixe melhor" que a pesquisa (§2.4) aponta como metade do porquê
 * cliente indicado vale mais.
 *
 * **Só o primeiro nome, e é decisão de privacidade, não de estilo.** Quem tem o link vê esse
 * nome, e o link circula em WhatsApp de terceiro. A própria cliente é quem compartilhou, então
 * ela está revelando o próprio nome de propósito — mas sobrenome é dado a mais sem função aqui.
 * Mesma regra que `aplicarVariaveis` já aplica nas mensagens prontas.
 *
 * Devolve `null` em silêncio para token ausente, vencido, de outro tenant, de cliente excluída ou
 * **eliminada** (`anonymized_at`, LGPD art. 18 VI — o nome dela virou "Cliente eliminada", e
 * estampar isso na página seria pior que não mostrar nada). Nunca lança: um convite velho não pode
 * transformar "agendar" em "não consigo agendar".
 */
export async function quemIndicou(slug: string, token: string | null | undefined): Promise<string | null> {
  if (!token) return null
  const clientId = verificarTokenIndicacao(token)
  if (!clientId) return null

  return withNovoTenant(async (svc) => {
    const tenant = await tenantPeloSlug(svc, slug).catch(() => null)
    if (!tenant) return null

    const { data } = await svc
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .is('anonymized_at', null)
      .maybeSingle()

    return data?.name ? primeiroNome(data.name) : null
  })
}

export const EsquemaBookingPublico = z.object({
  serviceId: z.uuid('Escolha um serviço.'),
  professionalId: z.uuid().nullish(),
  startsAt: z.iso.datetime({ message: 'Horário inválido.', offset: true }),
  name: z.string().trim().min(2, 'Digite seu nome.'),
  phone: z.string().trim().min(1, 'Digite seu telefone.'),
  // Opcional: quem prefere ser avisado por e-mail deixa o telefone valendo só
  // como WhatsApp. `clients.email` já existe desde a migration base — nunca
  // usado pelo agendamento público até este ticket.
  email: z.email('E-mail inválido.').nullish(),
  // docs/09-PLATAFORMA.md G3+G13 (P2.5): opcional, sem geocodificação — só
  // texto, pro profissional saber pra onde ir quando o atendimento não é no
  // endereço fixo do negócio.
  address: z.string().trim().max(300, 'Endereço muito longo.').nullish(),
  captchaToken: z.string().nullish(),
  // Honeypot (G100/TICKET-027): campo que só um robô preenche. Sem limite de
  // tamanho aqui de propósito — um `max(0)` faria o Zod recusar a requisição
  // com VALIDATION_ERROR antes de a rota decidir o que fazer, e aí a resposta
  // já entregaria "notei o honeypot" para quem está tentando burlar. A
  // decisão de responder como sucesso sem criar nada é da rota, não do schema.
  website: z.string().nullish(),
  // I-1, `docs/30-INDICACAO-PLANO.md` §4.1: token assinado de `/{slug}?ind=`. Só string — a
  // verificação (escopo, expiração, existência do referenciador no tenant) é toda de
  // `criarAgendamentoPublico`, não do schema. Um token inválido nunca vira erro de validação:
  // vira, na pior das hipóteses, um agendamento sem indicação.
  ind: z.string().trim().nullish(),
})

/**
 * `POST .../book`. Reaproveita `criarAgendamento()` inteiro — mesma exclusion
 * constraint, mesmo `SLOT_TAKEN` com alternativas, mesma reutilização de
 * cliente por telefone (o que já entrega "resposta idêntica para telefone
 * novo e existente" do TICKET-027: o retorno de sucesso é o mesmo dos dois
 * jeitos, porque `resolverCliente` não diferencia por fora).
 */
export async function criarAgendamentoPublico(slug: string, entrada: z.infer<typeof EsquemaBookingPublico>) {
  const telefone = normalizarTelefoneBR(entrada.phone)
  if (!telefone) throw AppError.validacao({ phone: 'Telefone inválido. Confira o DDD e o número.' })

  return withNovoTenant(async (svc) => {
    const tenant = await tenantPeloSlug(svc, slug)

    let professionalId = entrada.professionalId ?? undefined
    if (!professionalId) {
      const disponiveis = await disponibilidadePublica(slug, entrada.serviceId, entrada.startsAt.slice(0, 10))
      const achado = disponiveis.find((s) => s.startsAt === entrada.startsAt)
      if (!achado) {
        throw new AppError('SLOT_TAKEN', { details: { alternatives: disponiveis.slice(0, 3).map((s) => s.startsAt) } })
      }
      professionalId = achado.professionalId
    }

    // I-1: resolve o `client_id` de quem indicou. Escopo próprio (`indicacao`) impede um token
    // de avaliação ou de orçamento ser aceito aqui — mesma proteção que já vale para os outros
    // três. Token ausente, vencido ou de outro tenant vira `null` em silêncio: um convite velho
    // não pode transformar "agendar" em "não consigo agendar".
    const referredBy = entrada.ind ? verificarTokenIndicacao(entrada.ind) : null

    const agendamento = await criarAgendamento(
      svc,
      tenant.id,
      tenant.timezone,
      null,
      {
        clientDraft: { name: entrada.name, phone: telefone, email: entrada.email ?? null },
        serviceId: entrada.serviceId,
        professionalId,
        startsAt: entrada.startsAt,
        origin: 'public_page',
        note: null,
        address: entrada.address ?? null,
      },
      tenant.settings,
      referredBy,
    )

    // §4 eixo 3 (docs/09-PLATAFORMA.md): o cliente já lê "você vai receber a
    // confirmação por WhatsApp", mas até aqui nada avisava a equipe que
    // existe um pedido esperando — o aviso valia pra qualquer tenant, não só
    // pra quem tiver `inicio = solicitacao` no futuro. Melhor esforço: uma
    // falha de push nunca pode derrubar o agendamento que acabou de nascer.
    void notificarEquipe(svc, tenant.id, {
      title: 'Novo pedido de agendamento',
      body: `${entrada.name} pediu horário para ${quandoLocal(entrada.startsAt, tenant.timezone)}.`,
    }).catch((erro: unknown) => {
      console.error(JSON.stringify({ level: 'error', event: 'push_equipe_falhou', tenantId: tenant.id }), erro)
    })

    /*
     * `docs/34-PAGINA-PUBLICA-PLANO.md`, Fase 2 — "reconhecer quem já é cliente". O token só
     * chega ao navegador de quem ACABOU de provar, agendando, que este telefone é dele; fica só
     * no `localStorage`, nunca em cookie nem em URL (`reconhecimento.ts` explica por quê).
     */
    return { appointmentId: agendamento.id, reconhecimentoToken: gerarTokenReconhecimento(tenant.id, telefone) }
  })
}
