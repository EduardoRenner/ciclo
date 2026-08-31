/**
 * Quais rotas de cron rodam SOZINHAS em produção — e por que `/api/health` precisa saber disso.
 *
 * Medido na produção em 26/08/2026, 17:38 UTC-3: `/api/health` devolvia **503** com
 * `job "send_reminders" sem execução há 454 min (limite 30 min)`. Não havia defeito nenhum.
 * `reminders` está DELIBERADAMENTE fora do `on.schedule` de `.github/workflows/cron.yml` — ela
 * manda mensagem para cliente final, e ligá-la é decisão do dono do produto (F0, passo 4 de
 * `docs/25-ESTRATEGIA-E-EXECUCAO.md`). Vigiar com limiar de 30 min um job que ninguém dispara
 * deixa o endpoint vermelho para sempre.
 *
 * Isso é pior do que parece, e é o mesmo defeito de 25 e 26/08 pelo avesso: com o alarme tocando
 * todo dia por um motivo conhecido e inofensivo, o dia em que o Motor de Ciclo morrer de verdade
 * não muda a cor de nada. `docs/24` §6.6 acabou de pagar dois dias de silêncio para descobrir
 * isso; um 503 permanente devolve o produto ao mesmo lugar por outro caminho.
 *
 * O próprio `cron.yml` já tinha o raciocínio escrito — passo 4: *"ativá-lo antes faria o Action
 * falhar sempre, porque um heartbeat que nunca rodou está sempre atrasado por definição"*. Ele
 * foi aplicado ao step de CI e não ao `/api/health`, que fazia exatamente isso desde já.
 *
 * **Por que a lista mora aqui e não é lida do YAML:** o bundle da Vercel não carrega `.github/`,
 * então o runtime não tem como abrir o arquivo de verdade. Esta é uma cópia, e cópia sem guarda
 * apodrece — `tests/unit/server/saude-vigia-so-o-que-roda.test.ts` reprova nas DUAS direções:
 * rota agendada fora daqui, e rota daqui que não está agendada.
 */

/** Toda rota sob `src/app/api/cron/`. O teste confere contra o disco. */
export const ROTAS_DE_CRON = ['campaigns', 'jobs', 'recompute-cycles', 'reminders', 'segments', 'stock-alerts'] as const

export type RotaDeCron = (typeof ROTAS_DE_CRON)[number]

/**
 * As que estão no `on.schedule` + na matriz do job `seguros`. As outras quatro existem só no
 * `workflow_dispatch`, cada uma por um motivo escrito no `cron.yml`.
 */
export const ROTAS_AGENDADAS: readonly RotaDeCron[] = ['recompute-cycles', 'segments']

/** `kind` do heartbeat (o que a rota grava em `cron_heartbeats`) → rota que o grava. */
export const ROTA_DO_HEARTBEAT = {
  send_reminders: 'reminders',
  send_campaigns: 'campaigns',
  recompute_cycles: 'recompute-cycles',
  recompute_segments: 'segments',
} as const satisfies Record<string, RotaDeCron>

export type KindDeHeartbeat = keyof typeof ROTA_DO_HEARTBEAT

export function rodaSozinha(rota: RotaDeCron): boolean {
  return ROTAS_AGENDADAS.includes(rota)
}

/**
 * Se faz sentido cobrar execução recente deste heartbeat.
 *
 * `kind` desconhecido é vigiado: o padrão seguro é alarmar. Só quem tem uma rota conhecida e
 * comprovadamente não-agendada sai da vigilância — e volta sozinho no dia em que a rota entrar
 * no `schedule`, porque `ROTAS_AGENDADAS` é conferida contra o `cron.yml` a cada build.
 */
export function heartbeatVigiado(kind: string): boolean {
  const rota = ROTA_DO_HEARTBEAT[kind as KindDeHeartbeat]
  return rota === undefined || rodaSozinha(rota)
}
