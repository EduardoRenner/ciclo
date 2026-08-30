import { z } from 'zod'

import { contextoAtual } from '@/server/auth/tenant'
import { writeAudit } from '@/server/audit/write'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { lerCorpo } from '@/server/http/body'
import { exigirModulo } from '@/server/services/planos'
import { limitador } from '@/server/services/rate-limit'
import { perguntarAoAssistente } from '@/server/services/assistente'
import { GeminiProvider } from '@/server/providers/ai/gemini'
import { ErroDeInferencia } from '@/server/providers/ai/types'

const EsquemaPergunta = z.object({
  pergunta: z.string().trim().min(1, 'Digite uma pergunta.').max(500, 'Pergunta muito longa.'),
})

// 2026-08-30: `executarLaco` (assistente.ts) permite até MAX_CHAMADAS_DE_FERRAMENTA + 1 = 4
// chamadas ao Gemini em sequência (escolhe ferramenta → repete até responder em texto). Cada
// uma aborta sozinha em TIMEOUT_MS (gemini.ts, 15s) no pior caso — 4×15s = 60s no limite
// absoluto, bem acima do padrão da plataforma (10s) sem isto. Piso alto de propósito: é melhor
// a função esperar do que morrer antes do timeout interno conseguir agir e devolver 503 correto.
export const maxDuration = 60

// docs/26-AGENTE-IA-PLANO.md §4.4: teto por tenant e por usuário, para conter abuso — não para
// conter custo normal (a R$ 0,004/pergunta o custo em si não justifica limite nenhum).
const LIMITE_POR_TENANT_DIA = { limite: 60, janelaSegundos: 86_400 }
const LIMITE_POR_USUARIO_HORA = { limite: 20, janelaSegundos: 3_600 }

const provider = new GeminiProvider()

/**
 * `POST /api/v1/assistant`. Só o dono ou quem tem alguma permissão de leitura chega até aqui —
 * a filtragem fina de QUAL ferramenta cada papel pode chamar acontece dentro de
 * `perguntarAoAssistente` (RBAC + módulo do plano, por ferramenta). Esta rota garante três
 * coisas antes disso: sessão + tenant válidos, módulo `assistant` liberado, e os dois tetos de
 * uso — nada mais.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  const { pergunta } = await lerCorpo(req, EsquemaPergunta)

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
      provider,
      db,
      tenantId: ctx.tenantId,
      timezone: tenant?.timezone ?? 'America/Sao_Paulo',
      papel: ctx.papel,
      pergunta,
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

  // `proposta` vai junto quando alguma ferramenta preparou uma ação: é o que a tela transforma
  // em cartão com botão. Sem ela o campo simplesmente não existe na resposta, e o chat segue
  // sendo só texto — nenhuma tela quebra por isso.
  return { resposta: resultado.resposta, ferramentasUsadas: resultado.ferramentasUsadas, proposta: resultado.proposta }
})
