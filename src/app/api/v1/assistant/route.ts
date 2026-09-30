import { z } from 'zod'

import { contextoAtual } from '@/server/auth/tenant'
import { writeAudit } from '@/server/audit/write'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { lerCorpo } from '@/server/http/body'
import { exigirModulo } from '@/server/services/planos'
import { registrarEvento } from '@/server/services/product-events'
import { limitador } from '@/server/services/rate-limit'
import { perguntarAoAssistente, type ResultadoDoAssistente } from '@/server/services/assistente'
import { LIMITE_POR_TENANT_DIA, LIMITE_POR_USUARIO_HORA } from '@/server/assistente/limites-de-uso'
import { MotorDeConversa } from '@/server/providers/ai/motor'
import { ErroDeInferencia } from '@/server/providers/ai/types'

const EsquemaPergunta = z.object({
  pergunta: z.string().trim().min(1, 'Digite uma pergunta.').max(500, 'Pergunta muito longa.'),
  // docs/85 MI-4: o contexto que a resposta anterior devolveu. Opaco aqui — quem valida a forma é o
  // Motor (`lerContexto`, esquema fechado com tamanho travado); fora da forma, vira "sem contexto".
  contexto: z.unknown().optional(),
})

// Com o Gemini, 4 chamadas de até 15s pediam 60s. Com o Motor de Inteligência (docs/85 MI-2) o
// provedor responde na hora: o que resta são até 3 consultas ao banco pelas ferramentas.
export const maxDuration = 30

/**
 * `POST /api/v1/assistant`. Só o dono ou quem tem alguma permissão de leitura chega até aqui —
 * a filtragem fina de QUAL ferramenta cada papel pode chamar acontece dentro de
 * `perguntarAoAssistente` (RBAC + módulo do plano, por ferramenta). Esta rota garante três
 * coisas antes disso: sessão + tenant válidos, módulo `assistant` liberado, e os dois tetos de
 * uso — nada mais.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  const { pergunta, contexto } = await lerCorpo(req, EsquemaPergunta)

  const db = await criarClienteDoUsuario()

  // docs/26 §4.4: assistente desligado (pelo dono ou fora do plano) não aparece — 403 aqui é o
  // que faz o botão sumir na UI, nunca "não consegui responder".
  await exigirModulo(db, ctx.tenantId, 'assistant')

  const [{ permitido: podeTenant }, { permitido: podeUsuario }] = await Promise.all([
    limitador(`assistant:tenant:${ctx.tenantId}`, LIMITE_POR_TENANT_DIA),
    limitador(`assistant:usuario:${ctx.sessao.userId}`, LIMITE_POR_USUARIO_HORA),
  ])
  if (!podeTenant) throw AppError.limiteDeTaxa(LIMITE_POR_TENANT_DIA.janelaSegundos)
  if (!podeUsuario) throw AppError.limiteDeTaxa(LIMITE_POR_USUARIO_HORA.janelaSegundos)

  const { data: tenant, error: erroTenant } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).maybeSingle()
  if (erroTenant) throw new AppError('INTERNAL', { cause: erroTenant })

  let resultado
  try {
    resultado = await perguntarAoAssistente({
      // Um por pergunta: o Motor precisa do fuso do salão para saber que dia é "amanhã".
      provider: new MotorDeConversa(tenant?.timezone ?? 'America/Sao_Paulo'),
      db,
      tenantId: ctx.tenantId,
      timezone: tenant?.timezone ?? 'America/Sao_Paulo',
      papel: ctx.papel,
      pergunta,
      contexto,
    })
  } catch (erro) {
    if (erro instanceof ErroDeInferencia) {
      // Sem credencial ou o provedor fora do ar: 503, nunca uma resposta de texto fingindo que
      // respondeu. É a mesma regra do §4.4 aplicada ao caminho de erro, não só ao botão sumir.
      throw new AppError('ASSISTANT_UNAVAILABLE', { cause: erro })
    }
    throw erro
  }

  // docs/26 §4.4: audita a PERGUNTA e quais ferramentas rodaram — nunca a resposta, que pode
  // carregar nome de cliente sem nenhum valor de auditoria em troca.
  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'assistant.ask',
      entity: 'assistant',
      after: { pergunta, ferramentasUsadas: resultado.ferramentasUsadas },
      requestId,
    },
    req,
  )

  // docs/85 MI-7: a pergunta que ficou sem resposta de verdade vira contagem — motivo e tema de uma
  // lista fechada, nunca o texto (pode ter nome ou dado de saúde, regra 9). Nunca lança.
  if (resultado.sinal && typeof resultado.sinal === 'object') {
    await registrarEvento(db, ctx.tenantId, 'assistente_sem_resposta', resultado.sinal as Record<string, string>)
  }

  return corpoDaResposta(resultado)
})

/**
 * O que a rota devolve, campo por campo — lista explícita de propósito, para nada que o laço venha
 * a carregar vazar sem alguém decidir.
 *
 * `proposta` vai junto quando alguma ferramenta preparou uma ação: é o que a tela transforma em
 * cartão com botão. Sem ela o campo simplesmente não existe na resposta, e o chat segue sendo só
 * texto — nenhuma tela quebra por isso.
 *
 * `contexto` (docs/85 MI-4) volta para a tela devolver com a próxima pergunta. Esquecê-lo aqui foi
 * medido no navegador em 29/09: o laço devolvia, a rota descartava, e "e sexta?" virava "não
 * entendi" sem erro nenhum. Não vai para a auditoria (acima): carrega nome de gente.
 */
export function corpoDaResposta(resultado: ResultadoDoAssistente) {
  return {
    resposta: resultado.resposta,
    ferramentasUsadas: resultado.ferramentasUsadas,
    proposta: resultado.proposta,
    contexto: resultado.contexto,
    // docs/85 MI-3: os botões de próximo passo.
    sugestoes: resultado.sugestoes,
  }
}
