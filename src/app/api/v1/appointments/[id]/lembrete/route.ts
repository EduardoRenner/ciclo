import { UUID } from '@/core/text/uuid'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { lembreteDaVespera } from '@/server/services/lembrete-da-vespera'

type Ctx = { params: Promise<{ id: string }> }

/**
 * docs/114 L-07 (parte 2): o número e o texto do lembrete da véspera, para a profissional mandar pelo
 * próprio WhatsApp com um toque. Só leitura: nada sai daqui, quem envia é a pessoa, no app dela. O
 * link de remarcar ou cancelar é assinado no servidor, por isso a tela não monta o texto sozinha.
 */
export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  const escopo = exigirPermissao(ctx.papel, 'appointment:read')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse agendamento não existe mais.' })

  return { lembrete: await lembreteDaVespera(await criarClienteDoUsuario(), ctx.tenantId, id, escopo) }
})
