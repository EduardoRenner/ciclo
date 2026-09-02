import { dataLocalDe } from '@/core/cron/janela'
import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { limitador } from '@/server/services/rate-limit'
import { recomputarCiclosDoTenant } from '@/server/services/ciclo'
import { recalcularSegmentosDoTenant } from '@/server/services/segmentos'

/**
 * Recalcular o Motor de Ciclo agora, a pedido do dono.
 *
 * ## Por que isto existe
 *
 * Até aqui, `client_cycles` só era escrito por `/api/cron/recompute-cycles`, atrás do
 * `CRON_SECRET`. Ou seja: **o dono da conta não tinha botão nenhum**. Quando o agendador cai — e
 * ele caiu — o produto envelhece em silêncio e ninguém consegue consertar de dentro do app.
 *
 * Não é hipótese. Em 02/09/2026 o secret `CRON_BASE_URL` apontava para um alias da Vercel que
 * deixou de existir: **100% das execuções do dia falharam com `DEPLOYMENT_NOT_FOUND`**, e as seis
 * contas de demonstração ficaram com 1876 atendimentos concluídos e ZERO linhas em
 * `client_cycles`. O diferencial declarado do produto parado, sem nenhuma saída pela interface.
 *
 * Um agendador externo é uma dependência que vai cair de novo. O que não pode voltar a acontecer é
 * não haver escapatória.
 *
 * ## Por que `withNovoTenant` (service role) e não o cliente do usuário
 *
 * `client_cycles` é tabela escrita por job: não há política de RLS que deixe o dono escrever nela,
 * e criar uma abriria a porta para o cliente forjar previsão de retorno. O tenant vem SEMPRE do
 * contexto validado (`ctx.tenantId`), nunca do corpo — a regra da tabela de armadilhas.
 *
 * ## Por que teto de taxa, e por que este teto
 *
 * O recálculo de um tenant grande varre todo o histórico de agendamentos. Um botão sem freio é um
 * jeito de o próprio dono derrubar a conta dele. **2 por hora** cobre o caso real ("cliquei, deu
 * ruim, quero tentar de novo") sem virar laço. O limitador já cai para Postgres e depois memória
 * sozinho quando o Upstash não está configurado — mesmo caminho do booking público.
 *
 * Chave por TENANT, não por usuário: o custo é do banco do tenant, e dois sócios clicando ao mesmo
 * tempo têm que dividir o mesmo teto.
 */
export const POST = rota(async (req, _ctxRota, requestId) => {
  const ctx = await contextoAtual(req)
  // `tenant:update` não está na tabela de nenhum papel além do curinga do dono — mesma permissão
  // de "editar o negócio", e pela mesma razão: mexe na conta inteira, não num atendimento.
  exigirPermissao(ctx.papel, 'tenant:update')

  const limite = await limitador(`ciclo:recompute:${ctx.tenantId}`, { limite: 2, janelaSegundos: 3600 })
  if (!limite.permitido) {
    throw AppError.validacao({
      _: 'Você já pediu esse recálculo há pouco. Espere alguns minutos e tente de novo.',
    })
  }

  /*
   * Sem `Idempotency-Key`: o recálculo é idempotente por construção — `recomputarCiclosDoTenant`
   * faz upsert pela PK composta `(tenant_id, client_id, service_id)`, então rodar duas vezes
   * seguidas é idêntico a rodar uma. Guardar a resposta seria guardar um número que já envelheceu.
   */
  const { ciclos, segmentos } = await withNovoTenant(async (svc) => {
    const ciclos = await recomputarCiclosDoTenant(
      svc,
      ctx.tenantId,
      ctx.tenant.timezone,
      dataLocalDe(ctx.tenant.timezone, new Date()),
    )
    /*
     * Segmento depende do ciclo recém-escrito, então vem DEPOIS e na mesma requisição: recalcular
     * só o ciclo deixaria as listas inteligentes apontando para o estado anterior — duas fontes da
     * mesma verdade discordando, que é pior do que as duas velhas.
     *
     * Não derruba o pedido se falhar: o ciclo, que é o que a pessoa veio buscar, já está gravado.
     */
    const segmentos = await recalcularSegmentosDoTenant(svc, ctx.tenantId).catch((erro: unknown) => {
      console.warn(JSON.stringify({ level: 'warn', event: 'segmentos_falharam_no_recompute_manual' }), erro)
      return null
    })
    return { ciclos, segmentos }
  })

  await writeAudit({
    tenantId: ctx.tenantId,
    actorId: ctx.sessao.userId,
    actorRole: ctx.papel,
    action: 'ciclo.recompute',
    entity: 'client_cycles',
    entityId: ctx.tenantId,
    requestId,
    after: { ciclos, segmentosRecalculados: segmentos !== null },
  }, req)

  return { ciclos }
})
