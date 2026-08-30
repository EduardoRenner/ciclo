import { z } from 'zod'

import { contextoAtual } from '@/server/auth/tenant'
import { exigirPermissao } from '@/server/auth/rbac'
import { writeAudit } from '@/server/audit/write'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { lerCorpo } from '@/server/http/body'
import { exigirModulo } from '@/server/services/planos'
import { limitador } from '@/server/services/rate-limit'
import { IDS_RESPOSTA_RAPIDA, PERMISSAO_POR_ID, respostaRapida } from '@/server/assistente/respostas-rapidas'

const EsquemaPedido = z.object({
  id: z.enum(IDS_RESPOSTA_RAPIDA),
})

// Mesmo teto do `/api/v1/assistant` principal (docs/26 §4.4) — mesmo sem chamar o Gemini, ainda
// é consulta ao banco por clique, e o botão de sugestão pode ser martelado igual a um campo de
// texto livre.
const LIMITE_POR_TENANT_DIA = { limite: 60, janelaSegundos: 86_400 }
const LIMITE_POR_USUARIO_HORA = { limite: 20, janelaSegundos: 3_600 }

/**
 * `POST /api/v1/assistant/rapido`. Atalho SEM Gemini para as sugestões prontas que já têm
 * resposta 100% determinística num serviço existente — ver `respostas-rapidas.ts`. Mesmas
 * regras de acesso da rota principal (`assistant` liberado no plano), mais a permissão e o
 * módulo REAIS de cada id (`PERMISSAO_POR_ID`, o mesmo par que a ferramenta equivalente do
 * Gemini usa) — não dá para confiar só no módulo `assistant` aqui porque não existe filtragem
 * por ferramenta como no laço do Gemini; cada id tem que provar sua própria permissão.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  const { id } = await lerCorpo(req, EsquemaPedido)

  const db = await criarClienteDoUsuario()

  await exigirModulo(db, ctx.tenantId, 'assistant')
  const { modulo, permissao } = PERMISSAO_POR_ID[id]
  await exigirModulo(db, ctx.tenantId, modulo)
  exigirPermissao(ctx.papel, permissao)

  const [{ permitido: podeTenant }, { permitido: podeUsuario }] = await Promise.all([
    limitador(`assistant:tenant:${ctx.tenantId}`, LIMITE_POR_TENANT_DIA),
    limitador(`assistant:usuario:${ctx.sessao.userId}`, LIMITE_POR_USUARIO_HORA),
  ])
  if (!podeTenant) throw AppError.limiteDeTaxa(LIMITE_POR_TENANT_DIA.janelaSegundos)
  if (!podeUsuario) throw AppError.limiteDeTaxa(LIMITE_POR_USUARIO_HORA.janelaSegundos)

  const { data: tenant, error: erroTenant } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).maybeSingle()
  if (erroTenant) throw new AppError('INTERNAL', { cause: erroTenant })

  const resultado = await respostaRapida(id, { db, tenantId: ctx.tenantId, timezone: tenant?.timezone ?? 'America/Sao_Paulo' })

  // Mesma regra do `docs/26 §4.4` aplicada à rota principal: audita a pergunta (aqui, o id fixo)
  // e quais ferramentas rodaram, nunca a resposta.
  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'assistant.ask_rapido',
      entity: 'assistant',
      after: { id, ferramentasUsadas: resultado.ferramentasUsadas },
      requestId,
    },
    req,
  )

  return { resposta: resultado.resposta, ferramentasUsadas: resultado.ferramentasUsadas }
})
