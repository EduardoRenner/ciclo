import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { resumoDeHoje } from '@/server/services/resumo-hoje'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de resumo do dia precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let professionalId: string
let servicoId: string
let clientId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `hoje-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Hoje' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Hoje',
    vertical: 'waxing',
    slug: `hoje-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Esteticista de Teste',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Depilação de Teste',
    description: null,
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 4000,
    pricingModel: 'fixed',
    cycleDays: 21,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  servicoId = servico.id

  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente do Hoje', phone_e164: null }).select('id').single()
  clientId = cliente.data!.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

/**
 * Achado ao rodar perto da meia-noite de São Paulo (madrugada real desta
 * sessão): `Date.now() + minutosDeAgora` é aritmética em UTC puro, sem noção
 * de fuso — "-120min de agora" pode cair em ONTEM no calendário de São Paulo
 * mesmo que `resumoDeHoje()` calcule "hoje" corretamente via Temporal no
 * fuso do tenant. É a mesma classe de armadilha que o CLAUDE.md do projeto
 * já avisa para geração de slot. `ancora` deixa o teste escolher: os que
 * comparam passado/futuro contra o `agora` real do sistema (próxima
 * cliente, alertas) continuam usando `Date.now()`; o de faturado (que só
 * confere status dentro de "hoje", não passado/futuro) ancora ao meio-dia
 * de hoje em TZ — longe o bastante da meia-noite pros offsets usados
 * (±240min) nunca cruzarem o limite do dia.
 *
 * Os que usam o agora real não podem ancorar, mas também não precisam dos
 * minutos exatos: quem os escolhe é `futurosDeHoje`/`passadoDeHoje`, logo
 * abaixo, que encolhem os marcos até caberem no dia de hoje em TZ. É o que
 * fechou a flake que quebrava a CI em todo push feito à noite.
 */
async function inserirAgendamento(minutosDeAgora: number, status: string, ancora: Date = new Date()) {
  const inicio = new Date(ancora.getTime() + minutosDeAgora * 60_000)
  const fim = new Date(inicio.getTime() + 30 * 60_000)
  const { data, error } = await svc
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      professional_id: professionalId,
      service_id: servicoId,
      starts_at: inicio.toISOString(),
      ends_at: fim.toISOString(),
      status: status as never,
      price_cents: 4000,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/**
 * Quanto do dia de hoje já passou e quanto ainda resta, no fuso do TENANT — não em UTC.
 *
 * É isto que fecha a flake que quebrava a CI em todo push feito entre ~22:30 e a meia-noite de
 * São Paulo: `resumoDeHoje` filtra pelo dia de calendário em TZ, então um agendamento a
 * "+90 minutos de agora" nasce AMANHÃ quando faltam 84 minutos para a meia-noite, e o serviço
 * corretamente não o devolve. O mesmo vale espelhado: logo depois da meia-noite, "-30 minutos"
 * cai em ONTEM.
 *
 * Construído com `plainDate` + `toZonedDateTime`, e não somando 24h: dia de mudança de fuso tem
 * 23 ou 25 horas, e a regra 4 do CLAUDE.md existe exatamente por isso.
 */
function janelaDeHoje(): { atras: number; frente: number } {
  const agora = Temporal.Now.instant().toZonedDateTimeISO(TZ)
  const inicio = agora.toPlainDate().toZonedDateTime({ timeZone: TZ, plainTime: '00:00' })
  const fim = agora.toPlainDate().add({ days: 1 }).toZonedDateTime({ timeZone: TZ, plainTime: '00:00' })
  const min = (ms: number) => Math.floor(ms / 60_000)
  return {
    atras: min(agora.epochMilliseconds - inicio.epochMilliseconds),
    frente: min(fim.epochMilliseconds - agora.epochMilliseconds),
  }
}

/** O agendamento dura 30 min; a folga evita que o FIM dele é que cruze a meia-noite. */
const FOLGA_MIN = 35

/**
 * Os deslocamentos futuros que o caso quer, encolhidos proporcionalmente até caberem no que
 * ainda resta de hoje — preservando ORDEM e distinção, que é o que os casos de ordenação provam.
 *
 * Encolher é honesto aqui e ancorar num ponto fixo não seria: "próxima cliente" e "resto do dia"
 * afirmam *futuro contra o agora real*, e uma âncora tipo `meioDiaDeHoje` destruiria justamente
 * essa asserção (era o argumento, correto, do comentário que este bloco substitui). O que eles
 * NÃO afirmam é a distância exata em minutos — +45 e +90 são só "um depois do outro".
 *
 * `null` quando não resta dia suficiente nem para o cenário encolhido: aí o caso pula dizendo por
 * quê, em vez de falhar vermelho por causa do relógio.
 */
function futurosDeHoje(desejados: readonly number[]): number[] | null {
  const teto = janelaDeHoje().frente - FOLGA_MIN
  const maior = desejados[desejados.length - 1]!
  if (maior <= teto) return [...desejados]
  if (teto < desejados.length * 2) return null

  const fator = teto / maior
  const encolhidos = desejados.map((m, i) => Math.max(i + 1, Math.floor(m * fator)))
  // Floor pode empatar dois marcos vizinhos; a ordem estrita é o que o caso prova.
  for (let i = 1; i < encolhidos.length; i++) {
    if (encolhidos[i]! <= encolhidos[i - 1]!) encolhidos[i] = encolhidos[i - 1]! + 1
  }
  return encolhidos[encolhidos.length - 1]! <= teto ? encolhidos : null
}

/** O espelho: um marco no passado que ainda é HOJE. `null` logo depois da meia-noite. */
function passadoDeHoje(desejado: number): number | null {
  const teto = janelaDeHoje().atras - 5
  if (teto < 1) return null
  return -Math.min(Math.abs(desejado), teto)
}

describe('resumoDeHoje', () => {
  it(
    'faturado hoje soma só o que já foi concluído (done), não o previsto',
    async () => {
      // Meio-dia de hoje em TZ, não `Date.now()`: este teste só confere status
      // dentro de "hoje" — não passado/futuro contra o agora real — então pode
      // ancorar num ponto seguro, longe da meia-noite (ver comentário de
      // `inserirAgendamento`).
      const meioDiaDeHoje = new Date(
        Temporal.Now.instant().toZonedDateTimeISO(TZ).toPlainDate().toZonedDateTime({ timeZone: TZ, plainTime: '12:00' }).epochMilliseconds,
      )
      await inserirAgendamento(-120, 'done', meioDiaDeHoje)
      await inserirAgendamento(-60, 'confirmed', meioDiaDeHoje) // não conta: ainda não foi concluído

      const resumo = await resumoDeHoje(svc, tenantId, TZ)
      expect(resumo.revenueTodayCents).toBeGreaterThanOrEqual(4000)
    },
    30_000,
  )

  it(
    'próxima cliente é o primeiro agendamento futuro ainda válido, ignorando os já passados',
    async (ctx) => {
      const futuros = futurosDeHoje([45, 90])
      const passado = passadoDeHoje(-30)
      if (!futuros || passado === null) {
        ctx.skip(`não resta dia suficiente em ${TZ} para montar passado + dois futuros dentro de hoje`)
        return
      }

      await svc.from('appointments').delete().eq('tenant_id', tenantId) // dia limpo para este caso

      await inserirAgendamento(passado, 'confirmed') // já passou, mas ninguém marcou o desfecho — não é "próxima"
      const idFutura = await inserirAgendamento(futuros[0]!, 'confirmed')
      await inserirAgendamento(futuros[1]!, 'pending')

      const resumo = await resumoDeHoje(svc, tenantId, TZ)
      expect(resumo.nextClient?.id).toBe(idFutura)
    },
    30_000,
  )

  /**
   * O único caso que NÃO pode ser encolhido: ele prova a fronteira literal de 3 horas, então o
   * marco de +240 precisa estar simultaneamente FORA da janela de alerta e DENTRO de hoje.
   * Quando falta menos que isso para a meia-noite, as duas exigências são incompatíveis — e aí
   * o certo é pular dizendo por quê, não encolher (encolher moveria o +240 para dentro da janela
   * de 3h e o caso passaria a provar o contrário do que ele afirma).
   */
  it(
    'alerta é só pending que começa nas próximas 3 horas — confirmado não entra, mesmo que seja em breve',
    async (ctx) => {
      const FORA_DA_JANELA = 240
      if (janelaDeHoje().frente - FOLGA_MIN < FORA_DA_JANELA) {
        ctx.skip(`faltam menos de ${FORA_DA_JANELA + FOLGA_MIN} min para a meia-noite em ${TZ}: não dá para ter um agendamento fora da janela de 3h e ainda dentro de hoje`)
        return
      }

      await svc.from('appointments').delete().eq('tenant_id', tenantId)

      const idAlerta = await inserirAgendamento(60, 'pending')
      await inserirAgendamento(120, 'confirmed') // pending vira alerta, confirmed não precisa de atenção
      await inserirAgendamento(FORA_DA_JANELA, 'pending') // pending, mas longe demais (fora da janela de 3h)

      const resumo = await resumoDeHoje(svc, tenantId, TZ)
      expect(resumo.alerts.map((a) => a.id)).toEqual([idAlerta])
    },
    30_000,
  )

  /**
   * Era a FLAKE que quebrava a CI em todo push entre ~22:30 e a meia-noite de São Paulo, medida
   * ao ligar o CI (S13, 2026-08-24) e vista de novo em produção do CI em 2026-08-24T22:33 local.
   * `resumoDeHoje` filtra `restOfDay` pelo dia de calendário em TZ antes de comparar com o agora
   * real, então o `id2` a +90min nascia AMANHÃ e o serviço, corretamente, devolvia só `[id1]`.
   *
   * O registro anterior recusava consertar, e o argumento era bom: ancorar num ponto fixo como
   * `meioDiaDeHoje` destruiria a asserção de futuro/passado contra o agora real, que é o que
   * este caso existe para provar. **O que faltava era ver que há uma terceira saída.** Este caso
   * não afirma "+90 minutos"; afirma "dois futuros, nesta ordem, e o passado fora". `futurosDeHoje`
   * encolhe os marcos até caberem no que resta do dia preservando exatamente isso, e
   * `passadoDeHoje` faz o espelho para a borda de logo depois da meia-noite.
   */
  it(
    'resto do dia inclui tudo que ainda vem, na ordem, e não repete o passado',
    async (ctx) => {
      const futuros = futurosDeHoje([30, 90])
      const passado = passadoDeHoje(-10)
      if (!futuros || passado === null) {
        ctx.skip(`não resta dia suficiente em ${TZ} para montar passado + dois futuros dentro de hoje`)
        return
      }

      await svc.from('appointments').delete().eq('tenant_id', tenantId)

      await inserirAgendamento(passado, 'done')
      const id1 = await inserirAgendamento(futuros[0]!, 'confirmed')
      const id2 = await inserirAgendamento(futuros[1]!, 'pending')

      const resumo = await resumoDeHoje(svc, tenantId, TZ)
      expect(resumo.restOfDay.map((a) => a.id)).toEqual([id1, id2])
    },
    30_000,
  )

  it(
    'agendamento cancelado não aparece em nenhuma seção',
    async (ctx) => {
      /*
       * Este é o caso mais traiçoeiro dos cinco, e o único cujo defeito NÃO aparecia como
       * vermelho: ele afirma que todas as seções ficam vazias. Se o agendamento a +30min
       * escorregar para amanhã, tudo continua vazio e o caso passa — vazio pelo motivo errado,
       * sem provar que "cancelado é ignorado". Falso verde é pior que flake: flake incomoda,
       * falso verde tranquiliza.
       */
      const futuros = futurosDeHoje([30])
      if (!futuros) {
        ctx.skip(`não resta dia suficiente em ${TZ} para colocar o cancelado dentro de hoje — sem isso o caso passaria vazio, sem provar nada`)
        return
      }

      await svc.from('appointments').delete().eq('tenant_id', tenantId)
      await inserirAgendamento(futuros[0]!, 'canceled')

      const resumo = await resumoDeHoje(svc, tenantId, TZ)
      expect(resumo.restOfDay).toEqual([])
      expect(resumo.nextClient).toBeNull()
      expect(resumo.alerts).toEqual([])
    },
    30_000,
  )
})
