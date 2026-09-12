import { Temporal } from '@js-temporal/polyfill'

import { computeCycle } from '@/core/cycle/compute'
import { valorEmRiscoCents } from '@/core/cycle/valor-em-risco'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Põe no Motor de Ciclo quem o salão **já atendia antes de existir CICLO**.
 *
 * Mora num módulo só porque há DUAS portas de entrada para a mesma base e elas não podem divergir:
 *
 *   - a planilha (`importacao-clientes.ts`), para quem tem CSV;
 *   - a memória (`quem-ja-atendo.ts`), para quem tem a clientela na cabeça — que é a maioria.
 *
 * Duplicar esta fórmula seria criar duas definições do mesmo cálculo, cada uma com a sua guarda,
 * divergindo com as duas suítes verdes. Já aconteceu nesta base.
 *
 * O que ela faz: roda `computeCycle` (o algoritmo de verdade do Motor, não um número decorativo) e
 * **grava** o resultado em `client_cycles` — que é de onde `v_clientes_a_recuperar`, e portanto
 * `/admin/hoje` e `/admin/recuperar`, leem. Antes de 2026-09-10 o cálculo acontecia e era jogado
 * fora; a tela mostrava o número certo uma vez e o salão continuava em R$ 0,00.
 */

/** Lotes de 100: mesmo teto do importador, pelo mesmo motivo de tamanho de URL do gateway. */
const TAMANHO_DO_LOTE = 100

/** Cadastro que trouxe data de última visita — o par que o ciclo precisa. */
export type ClienteComUltimaVisita = { clientId: string; ultimaVisita: Temporal.PlainDate }

export type PrevisaoDaBase = {
  /** Quantos vieram com data de última visita válida. */
  comDataInformada: number
  /** Entre esses, quantos já passaram do ciclo esperado (`computeCycle` não devolveu on_track). */
  jaDevendoVoltar: number
  /**
   * Quantos viraram linha em `client_cycles` — ou seja, quantos o Motor passou de fato a
   * acompanhar. `0` quando ninguém escolheu serviço (ou quando a escrita falhou), e aí a previsão
   * acima é só uma prévia de tela.
   *
   * A distinção existe porque ela é a diferença entre a tela poder dizer "já está no Motor" e estar
   * mentindo. Os dois números vêm do MESMO cálculo; só este prova que ele sobreviveu à requisição.
   */
  cyclesGravados: number
}

/**
 * `defaultCycleDays` vem da média dos `cycle_days` do tenant (todo tenant sai do onboarding com um
 * pacote de serviços — TICKET-072); 30 dias é só o último recurso, para um tenant sem nenhum
 * serviço configurado.
 *
 * Sem `serviceId`, nada é persistido e `cyclesGravados` volta `0`. Não é degradação silenciosa: é o
 * caminho de quem não soube responder qual serviço, e o contador existe para a tela dizer a verdade
 * sobre o que aconteceu.
 */
export async function preverEPersistirCiclos(
  db: SupabaseClient<Database>,
  tenantId: string,
  pessoas: readonly ClienteComUltimaVisita[],
  serviceId: string | null,
): Promise<PrevisaoDaBase | null> {
  if (pessoas.length === 0) return null

  const { data: servicos, error } = await db
    .from('services')
    .select('id, cycle_days, price_cents')
    .eq('tenant_id', tenantId)
    .gt('cycle_days', 0)
  if (error) throw new AppError('INTERNAL', { cause: error })

  const ciclos = (servicos ?? []).map((s) => s.cycle_days).filter((c): c is number => c !== null)
  const defaultCycleDays = ciclos.length > 0 ? Math.round(ciclos.reduce((soma, c) => soma + c, 0) / ciclos.length) : 30

  /*
    O serviço escolhido manda no ritmo e no preço — é dele que sai tanto o `personal_cycle_days`
    quanto o dinheiro que a tela "Hoje" soma. `?? null` porque o id vem do cliente: um serviço de
    outro tenant, ou apagado entre a tela e o envio, não pode virar linha de ciclo (a RLS recusaria
    de qualquer jeito, mas o `find` falha antes e sem erro feio).
  */
  const escolhido = serviceId ? (servicos ?? []).find((s) => s.id === serviceId) ?? null : null
  const cicloDoServico = escolhido?.cycle_days ?? defaultCycleDays

  const hoje = Temporal.Now.plainDateISO()
  const calculados = pessoas.map((c) => ({
    ...c,
    resultado: computeCycle({ history: [{ date: c.ultimaVisita }], defaultCycleDays: cicloDoServico, today: hoje }),
  }))
  const jaDevendoVoltar = calculados.filter((c) => c.resultado.state !== 'on_track').length

  if (!escolhido) return { comDataInformada: pessoas.length, jaDevendoVoltar, cyclesGravados: 0 }

  let cyclesGravados = 0
  for (let i = 0; i < calculados.length; i += TAMANHO_DO_LOTE) {
    const lote = calculados.slice(i, i + TAMANHO_DO_LOTE)
    const { error: erroCiclo } = await db.from('client_cycles').upsert(
      lote.map((c) => ({
        tenant_id: tenantId,
        client_id: c.clientId,
        service_id: escolhido.id,
        personal_cycle_days: c.resultado.personalCycleDays,
        last_visit_on: c.ultimaVisita.toString(),
        predicted_on: c.resultado.predictedDate.toString(),
        late_days: c.resultado.lateDays,
        state: c.resultado.state,
        value_at_risk_cents: valorEmRiscoCents(escolhido.price_cents ?? 0, c.resultado.state),
      })),
      { onConflict: 'tenant_id,client_id,service_id' },
    )
    /*
      O cadastro já entrou e não se desfaz por causa do ciclo. Falhar aqui degrada para "previsão só
      na tela", e o contador conta a verdade — a tela não pode anunciar "já está no Motor" sobre uma
      escrita que não aconteceu.
    */
    if (erroCiclo) {
      console.error(
        JSON.stringify({ level: 'error', event: 'ciclos_da_base_falharam', tenantId, quantidade: lote.length }),
        erroCiclo,
      )
      continue
    }
    cyclesGravados += lote.length
  }

  return { comDataInformada: pessoas.length, jaDevendoVoltar, cyclesGravados }
}
