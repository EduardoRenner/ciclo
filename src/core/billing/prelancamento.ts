/**
 * docs/87-LANCAMENTO-2-MESES-GRATIS-PLANO.md §2 e §3 — o programa de cortesia do pré-lançamento.
 *
 * Função pura, sem I/O (regra 5 do CLAUDE.md). Quem lê e grava `tenants.settings` é a camada de
 * `server/`; aqui só moram as DATAS, as regras que decidem o que cada data significa e o leitor
 * que desconfia do que veio do jsonb.
 *
 * ## Uma constante, e nenhuma data em outro lugar
 *
 * Todas as datas do programa moram em `PRELANCAMENTO`. Tela, texto de preço e cadastro formatam
 * A PARTIR dela (`descreverDia`); `tests/unit/design/data-do-lancamento-mora-num-lugar-so.test.ts`
 * reprova a mesma data escrita em outro arquivo. A regra E4 do docs/87 ("se o Portão 2 falhar,
 * prorrogo a cortesia de quem está ativo") é justamente "uma data nova na constante, sem código
 * novo" — só funciona se a data existir num lugar só.
 *
 * ## O dia vira à meia-noite de Brasília, não de UTC
 *
 * Toda data aqui é dia de CALENDÁRIO em `America/Sao_Paulo`. Um cadastro às 22h do dia 12/12 em
 * Brasília já é 13/12 em UTC; quem lê a data pelo relógio UTC negaria a cortesia longa a quem se
 * cadastrou dentro do prazo. `tests/unit/core/prelancamento.test.ts` roda a máquina em
 * `Pacific/Kiritimati` (UTC+14, onde o dia UTC vira 14 horas antes do de Brasília) para provar.
 *
 * ## Expiração preguiçosa
 *
 * Nada aqui escreve quando a cortesia acaba. Compara-se `ate` com "agora" a cada leitura. O cron do
 * GitHub já atrasou horas neste projeto (`cron-github-atrasa-horas`) e a lição registrada é que a
 * rota não pode depender do relógio de um agendador: com a comparação na leitura, a conta cai de
 * estado no minuto certo mesmo com o cron parado.
 */

import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import { ORDEM_DOS_PLANOS, type PlanoTier } from './planos'

export const FUSO_DO_PROGRAMA = 'America/Sao_Paulo'

/**
 * As datas do docs/87 §2.1, todas como dia de calendário `AAAA-MM-DD`.
 *
 * - `lancamento` (D0): a cortesia longa acaba aqui e a cobrança liga.
 * - `ultimoDiaDaCortesiaLonga`: D0 menos 30 dias. Quem se cadastra até este dia INCLUSIVE tem a
 *   cortesia até D0; quem chega depois tem o teste de `diasDoTeste`. Inclusivo de propósito: o dia
 *   12/12 dá exatamente 30 dias até D0, e o docs/87 D3 promete que "ninguém ganha menos de 30 dias
 *   na janela". O teste confere `lancamento - 30 dias === ultimoDiaDaCortesiaLonga`.
 * - `fundadorDe` / `fundadorAte`: a janela pública (D5). Só quem se cadastrou aqui leva a marca
 *   `fundador`, que é o gancho do preço travado por 12 meses.
 */
export const PRELANCAMENTO = {
  lancamento: '2027-01-11',
  ultimoDiaDaCortesiaLonga: '2026-12-12',
  fundadorDe: '2026-11-09',
  fundadorAte: '2026-12-12',
  diasDoTeste: 21,
  diasDeGraca: 7,
  diasDePausa: 90,
  /** Quantos dias ANTES do fim da pausa a pessoa é avisada (docs/87 D1). */
  avisosDaPausa: [30, 7],
  /** Últimos N dias em que a faixa passa a contar dias (docs/87 §3.1: "só nos últimos 14 dias"). */
  diasDaContagemRegressiva: 14,
  /**
   * O número que a chamada pública usa ("pelo menos 60 dias de tudo liberado"). Só é dito enquanto for
   * verdade para quem cria a conta HOJE; a partir do dia em que a cortesia restante fica menor, a
   * chamada passa a dizer a DATA (`ofertaDoCadastro`). Sem isso a página prometeria 60 dias a quem
   * se cadastra em 12/12 e entrega 30.
   */
  diasDaChamada: 60,
} as const

/**
 * O degrau que a cortesia libera: "tudo liberado", até 5 profissionais. Desde a D2 (docs/87) o
 * Equipe tem todos os módulos; antes disso "tudo" só existia no Avançado, que deixou de ser vendido.
 */
export const PLANO_DA_CORTESIA: PlanoTier = 'equipe'

export const ORIGENS_DA_CORTESIA = ['pre_lancamento', 'teste'] as const
export type OrigemDaCortesia = (typeof ORIGENS_DA_CORTESIA)[number]

/** O que fica em `tenants.settings.cortesia`. `ate` e `concedida_em` são instantes ISO em UTC. */
export type Cortesia = {
  plano: PlanoTier
  /** Exclusivo: a cortesia vale enquanto `agora < ate`, e `ate` é a meia-noite de Brasília. */
  ate: string
  origem: OrigemDaCortesia
  concedida_em: string
  fundador: boolean
}

// ---------------------------------------------------------------------------------------------
// Calendário em Brasília
// ---------------------------------------------------------------------------------------------

function diaEmBrasilia(instante: Date): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(instante.getTime()).toZonedDateTimeISO(FUSO_DO_PROGRAMA).toPlainDate()
}

/** O instante em que o dia começa em Brasília (a meia-noite local, não a de UTC). */
function inicioDoDia(dia: Temporal.PlainDate): Date {
  return new Date(dia.toZonedDateTime(FUSO_DO_PROGRAMA).epochMilliseconds)
}

/** "AAAA-MM-DD" do dia de Brasília em que o instante cai. */
export function diaDeBrasilia(instante: Date): string {
  return diaEmBrasilia(instante).toString()
}

/** Dias inteiros de calendário entre dois dias `AAAA-MM-DD` (positivo se `ate` é depois de `de`). */
function diasEntre(de: Temporal.PlainDate, ate: Temporal.PlainDate): number {
  return de.until(ate, { largestUnit: 'days' }).days
}

// ---------------------------------------------------------------------------------------------
// Conceder
// ---------------------------------------------------------------------------------------------

/**
 * O que a conta ganha ao se cadastrar em `agora` (docs/87 D3).
 *
 * Até `ultimoDiaDaCortesiaLonga` (dia de Brasília, inclusive): cortesia até D0. Depois, e para
 * sempre depois de D0: o teste de `diasDoTeste` dias, sem cartão. Conta criada depois de D0 nunca
 * recebe a cortesia longa porque `agora` já passou do último dia dela.
 *
 * O teste conta dias inteiros a partir do dia do cadastro e termina à meia-noite seguinte ao 21º
 * dia: nunca entrega menos do que o texto promete, e a data de fim é sempre um dia de calendário
 * que cabe numa frase ("até 3 de janeiro").
 */
export function cortesiaDoCadastro(agora: Date): Cortesia {
  const hoje = diaEmBrasilia(agora)
  const concedidaEm = agora.toISOString()

  if (Temporal.PlainDate.compare(hoje, Temporal.PlainDate.from(PRELANCAMENTO.ultimoDiaDaCortesiaLonga)) <= 0) {
    const fundador =
      Temporal.PlainDate.compare(hoje, Temporal.PlainDate.from(PRELANCAMENTO.fundadorDe)) >= 0 &&
      Temporal.PlainDate.compare(hoje, Temporal.PlainDate.from(PRELANCAMENTO.fundadorAte)) <= 0
    return {
      plano: PLANO_DA_CORTESIA,
      ate: inicioDoDia(Temporal.PlainDate.from(PRELANCAMENTO.lancamento)).toISOString(),
      origem: 'pre_lancamento',
      concedida_em: concedidaEm,
      fundador,
    }
  }

  return {
    plano: PLANO_DA_CORTESIA,
    ate: inicioDoDia(hoje.add({ days: PRELANCAMENTO.diasDoTeste + 1 })).toISOString(),
    origem: 'teste',
    concedida_em: concedidaEm,
    fundador: false,
  }
}

// ---------------------------------------------------------------------------------------------
// Ler (jsonb livre: nada garantido)
// ---------------------------------------------------------------------------------------------

const InstanteIso = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'instante inválido')

const EsquemaDaCortesia = z.object({
  plano: z.enum(ORDEM_DOS_PLANOS as unknown as [PlanoTier, ...PlanoTier[]]),
  ate: InstanteIso,
  origem: z.enum(ORIGENS_DA_CORTESIA),
  concedida_em: InstanteIso,
  fundador: z.boolean().default(false),
})

/**
 * Lê `tenants.settings.cortesia`. Valor ausente, de outro tipo, com degrau desconhecido ou com data
 * que não é data vira `null` ("sem cortesia") e NUNCA lança.
 *
 * Errar para "sem cortesia" é o lado seguro pelo mesmo raciocínio de `normalizarPlano`: um jsonb
 * corrompido que liberasse o degrau mais alto seria acesso grátis silencioso, e ninguém reclama do
 * que recebeu de graça. Quem perde o direito por um valor corrompido reclama, e o suporte
 * reescreve o valor.
 */
export function lerCortesia(settings: unknown): Cortesia | null {
  const bruto = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).cortesia : null
  if (!bruto || typeof bruto !== 'object') return null
  const r = EsquemaDaCortesia.safeParse(bruto)
  return r.success ? r.data : null
}

// ---------------------------------------------------------------------------------------------
// Situação da conta
// ---------------------------------------------------------------------------------------------

/**
 * - `pago`          — tem assinatura de um degrau pago (ou a cortesia dele já não muda nada).
 * - `cortesia`      — a cortesia vale e libera mais do que o pago.
 * - `graca`         — a cortesia acabou há menos de `diasDeGraca`: tudo funciona, faixa vermelha.
 * - `pausada`       — passou da graça sem assinar: lê e exporta tudo, não cria nada novo.
 * - `sem_cortesia`  — nunca recebeu cortesia (conta anterior ao programa, ou `settings` corrompido).
 *                     Comporta-se exatamente como antes do programa existir.
 */
export type EstadoDaConta = 'pago' | 'cortesia' | 'graca' | 'pausada' | 'sem_cortesia'

export type SituacaoDaConta = {
  estado: EstadoDaConta
  /** O degrau vigente, na definição de `planoVigente`. */
  plano: PlanoTier
  /**
   * O degrau que decide o que a pessoa ENXERGA. Igual a `plano`, menos na conta pausada: ali o
   * degrau de leitura continua o da cortesia, porque a regra 5.1 (`core/billing/planos.ts`) diz que
   * cair de degrau nunca esconde dado. Pausar trava CRIAR, não olhar.
   */
  planoDeLeitura: PlanoTier
  /** Falso só na conta pausada. É a resposta de "posso criar algo novo?". */
  podeEscrever: boolean
  cortesia: Cortesia | null
}

function posicao(tier: PlanoTier): number {
  return ORDEM_DOS_PLANOS.indexOf(tier)
}

function maior(a: PlanoTier, b: PlanoTier): PlanoTier {
  return posicao(a) >= posicao(b) ? a : b
}

/** Meia-noite de Brasília em que a graça termina (exclusivo). */
export function fimDaGraca(cortesia: Pick<Cortesia, 'ate'>): Date {
  return inicioDoDia(diaEmBrasilia(new Date(cortesia.ate)).add({ days: PRELANCAMENTO.diasDeGraca }))
}

/** Meia-noite de Brasília em que a pausa termina e a eliminação prevista nos termos passa a valer. */
export function fimDaPausa(cortesia: Pick<Cortesia, 'ate'>): Date {
  return inicioDoDia(
    diaEmBrasilia(new Date(cortesia.ate)).add({ days: PRELANCAMENTO.diasDeGraca + PRELANCAMENTO.diasDePausa }),
  )
}

/** O último dia em que a graça ainda deixa criar, como `AAAA-MM-DD` de Brasília. `fimDaGraca` é a meia-noite SEGUINTE a ele. */
export function ultimoDiaDaGraca(cortesia: Pick<Cortesia, 'ate'>): string {
  return diaDeBrasilia(new Date(fimDaGraca(cortesia).getTime() - 1))
}

/** O último dia em que a conta pausada ainda guarda tudo, antes da eliminação prevista nos termos. */
export function ultimoDiaDaPausa(cortesia: Pick<Cortesia, 'ate'>): string {
  return diaDeBrasilia(new Date(fimDaPausa(cortesia).getTime() - 1))
}

/**
 * O plano vigente: **o maior entre o plano pago e a cortesia ainda em pé** — a cortesia nunca
 * rebaixa quem já paga mais. "Em pé" inclui os 7 dias de graça (docs/87 D1: tudo funciona). Depois
 * da graça a cortesia deixou de contar e sobra o que a pessoa paga.
 */
export function planoVigente(planoPago: PlanoTier, cortesia: Cortesia | null, agora: Date): PlanoTier {
  if (!cortesia) return planoPago
  if (agora.getTime() < fimDaGraca(cortesia).getTime()) return maior(planoPago, cortesia.plano)
  return planoPago
}

export function situacaoDaConta(planoPago: PlanoTier, cortesia: Cortesia | null, agora: Date): SituacaoDaConta {
  const plano = planoVigente(planoPago, cortesia, agora)

  if (!cortesia) {
    return { estado: planoPago === 'gratis' ? 'sem_cortesia' : 'pago', plano, planoDeLeitura: plano, podeEscrever: true, cortesia }
  }

  const t = agora.getTime()
  const valida = t < new Date(cortesia.ate).getTime()
  const naGraca = !valida && t < fimDaGraca(cortesia).getTime()

  // Quem paga um degrau igual ou maior que o da cortesia não muda de estado por causa dela.
  if (planoPago !== 'gratis' && posicao(planoPago) >= posicao(cortesia.plano)) {
    return { estado: 'pago', plano, planoDeLeitura: plano, podeEscrever: true, cortesia }
  }

  if (valida) return { estado: 'cortesia', plano, planoDeLeitura: plano, podeEscrever: true, cortesia }
  if (naGraca) return { estado: 'graca', plano, planoDeLeitura: plano, podeEscrever: true, cortesia }

  if (planoPago !== 'gratis') {
    return { estado: 'pago', plano, planoDeLeitura: plano, podeEscrever: true, cortesia }
  }

  return {
    estado: 'pausada',
    plano,
    planoDeLeitura: maior(plano, cortesia.plano),
    podeEscrever: false,
    cortesia,
  }
}

// ---------------------------------------------------------------------------------------------
// Apresentação
// ---------------------------------------------------------------------------------------------

/** O último dia em que a cortesia vale, como `AAAA-MM-DD` de Brasília. `ate` é exclusivo, então é o dia anterior. */
export function ultimoDiaDaCortesia(cortesia: Pick<Cortesia, 'ate'>): string {
  return diaEmBrasilia(new Date(cortesia.ate)).subtract({ days: 1 }).toString()
}

/**
 * Quantos dias faltam para o último dia da cortesia, contando o de hoje como 0. Negativo depois do
 * fim. Serve à faixa: ela só conta dias quando `<= diasDaContagemRegressiva`.
 */
export function diasParaOFim(cortesia: Pick<Cortesia, 'ate'>, agora: Date): number {
  return diasEntre(diaEmBrasilia(agora), Temporal.PlainDate.from(ultimoDiaDaCortesia(cortesia)))
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/**
 * "11 de janeiro de 2027". Escrito à mão, e não com `Intl`, porque o texto que a pessoa lê antes
 * de criar a conta não pode variar com o ICU do servidor: a data é uma promessa e sai idêntica em
 * qualquer máquina.
 */
export function descreverDia(dia: string): string {
  const d = Temporal.PlainDate.from(dia)
  return `${d.day} de ${MESES[d.month - 1]} de ${d.year}`
}

/** "11 de janeiro", sem o ano — para frases onde o ano é óbvio pelo contexto. */
export function descreverDiaCurto(dia: string): string {
  const d = Temporal.PlainDate.from(dia)
  return `${d.day} de ${MESES[d.month - 1]}`
}

// ---------------------------------------------------------------------------------------------
// A oferta, como a página pública a diz antes de a conta existir (docs/87 §3.2)
// ---------------------------------------------------------------------------------------------

export type OfertaDoCadastro = {
  /** Cortesia até D0 (cadastro na janela) ou o teste de `diasDoTeste` dias (depois de 12/12). */
  longa: boolean
  /** A frase-título: "pelo menos 60 dias de tudo liberado, sem cartão", ou a data quando os 60 dias já não são verdade. */
  chamada: string
  /** O último dia de uso liberado, por extenso: "10 de janeiro de 2027". A data é fixa e real, nunca um contador. */
  fim: string
  /** O último dia em que o cadastro ainda leva a cortesia longa, sem o ano: "12 de dezembro". */
  ateQuandoALongaVale: string
}

/**
 * O que quem cria a conta em `agora` recebe e até quando, dito antes de criar a conta.
 *
 * Deriva de `cortesiaDoCadastro`, a MESMA função que concede no cadastro: o texto que a pessoa lê e
 * o que ela ganha não têm como divergir. Nenhuma frase de urgência: só a data de fim, que é fixa, e
 * um número (60) que some da chamada assim que deixa de ser verdade.
 */
export function ofertaDoCadastro(agora: Date): OfertaDoCadastro {
  const c = cortesiaDoCadastro(agora)
  const ultimo = ultimoDiaDaCortesia(c)
  const longa = c.origem === 'pre_lancamento'
  const diasInclusivos = diasEntre(diaEmBrasilia(agora), Temporal.PlainDate.from(ultimo)) + 1

  let chamada: string
  if (!longa) chamada = `${PRELANCAMENTO.diasDoTeste} dias de tudo liberado, sem cartão`
  else if (diasInclusivos >= PRELANCAMENTO.diasDaChamada) chamada = `Pelo menos ${PRELANCAMENTO.diasDaChamada} dias de tudo liberado, sem cartão`
  else chamada = `Tudo liberado até ${descreverDiaCurto(ultimo)}, sem cartão`

  return {
    longa,
    chamada,
    fim: descreverDia(ultimo),
    ateQuandoALongaVale: descreverDiaCurto(PRELANCAMENTO.ultimoDiaDaCortesiaLonga),
  }
}
