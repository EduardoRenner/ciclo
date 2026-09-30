import { writeAudit } from '@/server/audit/write'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { EsquemaPerfilOnboarding, gravarRespostaDePerfil } from '@/server/services/perfil-onboarding'

/**
 * `docs/83` §5.1–5.3 (P1) — grava a resposta (ou o pulo) da tela "Pra deixar o CICLO do seu
 * jeito", que aparece uma vez, logo depois que `executarOnboarding` já criou o tenant.
 *
 * Só telemetria: não muda nenhuma coluna do tenant nesta fase (pré-ajustar módulo e reordenar a
 * Central de Ações são a Pergunta 2/3, fora do escopo de P1) — por isso não exige nenhuma
 * permissão de escrita de cliente ou de configuração além de ter um vínculo ativo com o tenant.
 * Regra 6 do CLAUDE.md: escrita por `/api/v1` com `Idempotency-Key`, nunca Server Action, porque
 * a tela também precisa funcionar bem numa rede ruim logo depois do cadastro.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  const entrada = await lerCorpo(req, EsquemaPerfilOnboarding)
  const db = await criarClienteDoUsuario()

  await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/onboarding/perfil' }, async () => {
    const { efeitos } = await gravarRespostaDePerfil(db, ctx.tenantId, entrada, ctx.papel)
    // P5: quando a resposta muda o painel (módulo desligado, ordem da Central), fica na trilha —
    // mesma regra das rotas de módulos e de custo fixo.
    if (efeitos.length > 0) {
      await writeAudit(
        { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'tenant.perfil', entity: 'tenants', entityId: ctx.tenantId, after: { efeitos }, requestId },
        req,
      )
    }
    return { ok: true }
  })

  return { ok: true }
})
