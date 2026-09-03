import { heartbeatVigiado } from '@/core/cron/agendadas'
import { AppError } from '@/server/http/errors'
import { semHandlerRegistrado } from '@/server/services/job-queue'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const LIMIAR_FILA_PARADA_MIN = 15
const LIMIAR_HEARTBEAT_MIN = 30
// `send_campaigns` roda 1×/dia (10h local do tenant), não a cada 15min como `send_reminders` —
// usar o mesmo limiar de 30min o marcaria "atrasado" ~23h por dia, todo dia. 26h cobre um dia
// inteiro com folga para o cron de 5 horários (`.github/workflows/cron.yml`) atrasar.
const LIMIAR_HEARTBEAT_CAMPANHAS_MIN = 26 * 60
/*
 * `recompute_cycles` roda 1×/dia por tenant (janela de 3h local), igual a `send_campaigns` — daí
 * o mesmo 26h, que cobre um dia inteiro com folga para o agendador atrasar. O atraso medido em
 * 26/08 nos cinco disparos foi de 36 a 56 minutos, então 26h tem margem de sobra; apertar isso
 * transformaria o alarme em ruído diário, que é o jeito mais rápido de ninguém mais olhar.
 */
const LIMIAR_HEARTBEAT_CICLO_MIN = 26 * 60
const LIMIAR_FALHA_MENSAGEM = 0.05 // 5%, J129

export async function registrarHeartbeat(db: Cliente, kind: string): Promise<void> {
  const { error } = await db.from('cron_heartbeats').upsert({ kind, last_run_at: new Date().toISOString() }, { onConflict: 'kind' })
  if (error) throw new AppError('INTERNAL', { cause: error })
}

export type ChecagemSaude = {
  ok: boolean
  detail?: string
}

export type RelatorioSaude = {
  ok: boolean
  checks: {
    database: ChecagemSaude
    jobQueue: ChecagemSaude
    messages: ChecagemSaude
    sendReminders: ChecagemSaude
    sendCampaigns: ChecagemSaude
    recomputeCycles: ChecagemSaude
    recomputeSegments: ChecagemSaude
    errorTracking: ChecagemSaude
    assistente: ChecagemSaude
  }
}

/**
 * TICKET-058/J129: "/api/health que checa banco, fila e PSP. Alerta se: fila com item parado
 * >15min, taxa de erro 5xx >1%, mensagem failed >5% na hora, job send_reminders sem execução em
 * 30min." Taxa de erro 5xx não entra aqui — é métrica de request HTTP (Sentry/Vercel Analytics
 * já cobrem, sem endpoint próprio pra checar); PSP (Asaas) também fica de fora — TICKET-031/043
 * ainda bloqueados por credencial, nada pra checar até existir.
 */
export async function verificarSaude(db: Cliente, agora: Date = new Date()): Promise<RelatorioSaude> {
  const database = await checarBanco(db)
  const jobQueue = await checarFila(db, agora)
  const messages = await checarMensagens(db, agora)
  const sendReminders = await checarHeartbeat(db, 'send_reminders', agora)
  const sendCampaigns = await checarHeartbeat(db, 'send_campaigns', agora, LIMIAR_HEARTBEAT_CAMPANHAS_MIN)
  /*
   * O Motor de Ciclo entrou aqui em 26/08, depois de passar DOIS dias seguidos sem processar um
   * único tenant — com HTTP 200, job verde e ninguém sabendo. É o diferencial que sustenta o preço
   * do produto e era o único job de cron sem vigilância nenhuma.
   */
  const recomputeCycles = await checarHeartbeat(db, 'recompute_cycles', agora, LIMIAR_HEARTBEAT_CICLO_MIN)
  /*
   * `segments` entrou em 31/08 pelo mesmo motivo que o Motor de Ciclo entrou em 26/08, e é
   * desconfortável que tenha levado cinco dias: ela é a OUTRA rota do `on.schedule` e rodava seis
   * vezes por dia sem vigilância nenhuma. O conserto de 26/08 olhou o job que tinha falhado, não a
   * pergunta que o defeito fazia — "quais jobs agendados ninguém observa?". Agora há guarda para a
   * pergunta, não só para o caso: `tests/unit/server/todo-cron-agendado-tem-heartbeat.test.ts`.
   */
  const recomputeSegments = await checarHeartbeat(db, 'recompute_segments', agora, LIMIAR_HEARTBEAT_CICLO_MIN)
  const errorTracking = checarRastreioDeErro()
  const assistente = checarAssistente()

  return {
    ok:
      database.ok && jobQueue.ok && messages.ok && sendReminders.ok && sendCampaigns.ok &&
      recomputeCycles.ok && recomputeSegments.ok && errorTracking.ok && assistente.ok,
    checks: { database, jobQueue, messages, sendReminders, sendCampaigns, recomputeCycles, recomputeSegments, errorTracking, assistente },
  }
}

/**
 * O assistente tem credencial? — acrescentado em 2026-09-03, e o motivo é o custo de NÃO ter.
 *
 * O Eduardo relatou "O assistente está indisponível agora" em produção, e a primeira hipótese
 * (chave ausente) levou tempo para ser descartada. Ela era descartável em um segundo: o botão
 * flutuante só renderiza com `GEMINI_API_KEY` presente (`admin/layout.tsx`), então o botão estar
 * na tela já provava que a chave existe — e portanto que a falha é de execução, não de
 * configuração. Nada expunha isso; a conclusão exigiu ler três arquivos.
 *
 * Aqui a resposta fica a uma requisição de distância, e o valor não é diagnosticar a falha de hoje:
 * é **separar as duas causas** que produzem exatamente a mesma tela para quem usa.
 *
 * `ok: true` nos dois casos, de propósito, pela mesma razão do rastreio de erro logo abaixo:
 * assistente sem chave é degradação conhecida e conviável, e alarme que toca todo dia esconde o dia
 * em que algo quebra de verdade. O estado vai escrito no corpo, para quem opera poder ler.
 *
 * **Não chama o Gemini.** Uma checagem de saúde que gasta cota do provedor a cada batida do monitor
 * é um jeito caro de transformar observabilidade em conta no fim do mês.
 */
function checarAssistente(): ChecagemSaude {
  return process.env.GEMINI_API_KEY
    ? { ok: true, detail: 'assistente com credencial configurada (não verifica o provedor, para não gastar cota)' }
    : {
        ok: true,
        detail:
          'assistente SEM credencial (falta GEMINI_API_KEY) — o botão flutuante não aparece no painel. ' +
          'Se ele aparece e mesmo assim falha, a causa é o provedor, não a configuração.',
      }
}

/**
 * L-10 (`docs/31`): o rastreio de erro está mesmo ligado?
 *
 * A pergunta parece boba e não é. `SENTRY_DSN` é lido em tempo de **build** pelo `next.config.ts`
 * (que decide se aplica o `withSentryConfig`) e em tempo de execução pelo `instrumentation.ts`.
 * Quem criar a variável no painel da Vercel e não fizer um deploy novo terá a variável presente e
 * o rastreio **desligado** — e não há nada, em lugar nenhum, que diga isso. O jeito de descobrir
 * seria um erro de cliente pagante sumindo em silêncio, que é exatamente o que não pode acontecer.
 *
 * **Não derruba a saúde quando está desligado**, e isso é deliberado: hoje NÃO existe DSN em
 * produção, por decisão medida do `docs/28` (1,58 MB e ~500 ms de cold start para um SDK que não
 * mandava nada). Um 503 permanente por causa disso repetiria pela terceira vez o defeito que
 * `agendadas.ts` e `registro.ts` já consertaram nesta base — alarme que toca todo dia esconde o
 * dia em que algo quebra. O estado vai escrito no corpo, para quem for ligar poder conferir.
 */
function checarRastreioDeErro(): ChecagemSaude {
  const ligado = Boolean(process.env.SENTRY_DSN)
  return ligado
    ? { ok: true, detail: 'rastreio de erro no servidor ligado' }
    : {
        ok: true,
        detail:
          'rastreio de erro DESLIGADO (sem SENTRY_DSN) — erro de usuário não chega em ninguém. ' +
          'Lembre que a variável é lida no build: criar no painel da Vercel exige deploy novo.',
      }
}

/**
 * `/api/health` responde a **qualquer um**, sem autenticação — é o contrato dele (monitor externo
 * bate de fora). Então o texto que sai daqui é texto público, e `error.message` do Postgres não é:
 * ele carrega nome de tabela, de coluna, de constraint, e num erro de unicidade carrega o **valor**
 * que colidiu ("Key (phone_e164)=(+55...) already exists"). Era o telefone de uma cliente saindo
 * por um endpoint anônimo no dia em que o banco tossisse.
 *
 * O detalhe real vai para o log do servidor, que é onde quem opera consegue ler. Para fora sai só
 * qual checagem falhou — que é a única coisa que um monitor de uptime precisa saber.
 */
function falhaSemVazar(onde: string, erro: { message: string }): ChecagemSaude {
  console.error(JSON.stringify({ level: 'error', event: 'health_check_falhou', onde }), erro.message)
  return { ok: false, detail: `a checagem "${onde}" falhou — veja o log do servidor` }
}

async function checarBanco(db: Cliente): Promise<ChecagemSaude> {
  const { error } = await db.from('tenants').select('id', { head: true, count: 'exact' }).limit(1)
  return error ? falhaSemVazar('banco', error) : { ok: true }
}

/**
 * Duas perguntas diferentes, e até a auditoria de 2026-08-23 (achado S12) só a primeira era feita:
 *
 * 1. **Fila crescendo** — job `queued`/`failed` cuja hora já passou. Sintoma de worker que não
 *    está rodando — e hoje esse é o caso normal: a rota `jobs`, que drena a fila, só existe no
 *    `workflow_dispatch` do `.github/workflows/cron.yml`, nunca no `schedule`. (A nota antiga
 *    dizia "`vercel.json` com `crons: []`, plano Hobby": verdade, mas arquivo errado — o
 *    agendador é o GitHub Actions desde `docs/18` §L.5.) Esta checagem NÃO é dispensada como as
 *    de heartbeat: fila crescendo é trabalho enfileirado que não acontece, independentemente de
 *    quem devia drená-la.
 * 2. **Job preso em `running`** — worker que morreu no meio. `claim_jobs` passou a reivindicar
 *    esses de volta (migration 0037), mas com teto de `max_attempts`: um job que derruba o
 *    worker toda vez para de ser reivindicado em vez de derrubar um worker por rodada. Quando
 *    isso acontece, ele fica parado — e antes ficava parado E invisível, porque esta checagem
 *    contava só `queued`/`failed`. Trabalho sumindo em silêncio é exatamente o que o §7 proíbe.
 */
async function checarFila(db: Cliente, agora: Date): Promise<ChecagemSaude> {
  const limite = new Date(agora.getTime() - LIMIAR_FILA_PARADA_MIN * 60_000).toISOString()

  /*
   * Traz `kind` e `last_error`, e não só a contagem, porque a pergunta mudou em 30/08: não é
   * "quantos jobs estão parados?", é "quantos jobs que ALGUÉM PODE processar estão parados?".
   * O porquê, medido, está em `semHandlerRegistrado()` — sem essa distinção o endpoint vivia em
   * 503 por causa de resíduo de fixture que nenhum handler existe para atender.
   */
  const [aguardando, travados] = await Promise.all([
    db.from('job_queue').select('kind, last_error').in('status', ['queued', 'failed']).lt('run_after', limite),
    db.from('job_queue').select('kind, last_error').eq('status', 'running').lt('locked_at', limite),
  ])
  if (aguardando.error) return falhaSemVazar('fila (aguardando)', aguardando.error)
  if (travados.error) return falhaSemVazar('fila (travados)', travados.error)

  const processaveis = (linhas: { last_error: string | null }[] | null) =>
    (linhas ?? []).filter((j) => !semHandlerRegistrado(j.last_error)).length
  const lixo = [...(aguardando.data ?? []), ...(travados.data ?? [])].filter((j) => semHandlerRegistrado(j.last_error))

  const problemas: string[] = []
  const nAguardando = processaveis(aguardando.data)
  const nTravados = processaveis(travados.data)
  if (nAguardando > 0) problemas.push(`${nAguardando} job(s) parado(s) há mais de ${LIMIAR_FILA_PARADA_MIN} min`)
  if (nTravados > 0) problemas.push(`${nTravados} job(s) preso(s) em running há mais de ${LIMIAR_FILA_PARADA_MIN} min`)

  /*
   * O lixo aparece no relatório com o nome dos tipos, mas NÃO pinta o endpoint de vermelho: 503
   * quer dizer "o serviço está doente", e job que ninguém sabe processar não deixa o serviço
   * doente — deixa a fila suja. Esconder seria o erro oposto, então ele vai escrito.
   */
  const avisoDeLixo =
    lixo.length > 0
      ? `${lixo.length} job(s) de tipo sem handler (${[...new Set(lixo.map((j) => j.kind))].sort().join(', ')}) — não contam como fila parada`
      : null

  if (problemas.length > 0) {
    return { ok: false, detail: [...problemas, avisoDeLixo].filter(Boolean).join('; ') }
  }
  return avisoDeLixo ? { ok: true, detail: avisoDeLixo } : { ok: true }
}

async function checarMensagens(db: Cliente, agora: Date): Promise<ChecagemSaude> {
  const umaHoraAtras = new Date(agora.getTime() - 3_600_000).toISOString()
  const { data, error } = await db.from('messages').select('status').gte('created_at', umaHoraAtras)
  if (error) return falhaSemVazar('mensagens', error)
  if (!data || data.length === 0) return { ok: true }

  const falhas = data.filter((m) => m.status === 'failed').length
  const taxa = falhas / data.length
  return taxa <= LIMIAR_FALHA_MENSAGEM ? { ok: true } : { ok: false, detail: `${(taxa * 100).toFixed(1)}% de falha na última hora (limite ${LIMIAR_FALHA_MENSAGEM * 100}%)` }
}

/**
 * Cobra execução recente de um job de cron — mas só de quem tem quem o dispare.
 *
 * A ressalva não é zelo: em 26/08, medido na produção, este endpoint devolvia 503 por
 * `send_reminders` estar "atrasado" havia 454 minutos. `reminders` está fora do `schedule` de
 * propósito (`src/core/cron/agendadas.ts` explica), então o atraso era permanente e crescente —
 * e um 503 que nunca sai do vermelho esconde o vermelho que importa. A vigilância volta sozinha
 * no dia em que a rota entrar no `schedule`.
 */
async function checarHeartbeat(db: Cliente, kind: string, agora: Date, limiarMinutos: number = LIMIAR_HEARTBEAT_MIN): Promise<ChecagemSaude> {
  if (!heartbeatVigiado(kind)) {
    return { ok: true, detail: `job "${kind}" não está no schedule de .github/workflows/cron.yml — vigilância desligada de propósito` }
  }

  const { data, error } = await db.from('cron_heartbeats').select('last_run_at').eq('kind', kind).maybeSingle()
  if (error) return falhaSemVazar(`heartbeat "${kind}"`, error)
  if (!data) return { ok: false, detail: `job "${kind}" nunca rodou` }

  const minutosDesdeUltimoRun = (agora.getTime() - new Date(data.last_run_at).getTime()) / 60_000
  return minutosDesdeUltimoRun <= limiarMinutos
    ? { ok: true }
    : { ok: false, detail: `job "${kind}" sem execução há ${Math.round(minutosDesdeUltimoRun)} min (limite ${limiarMinutos} min)` }
}
