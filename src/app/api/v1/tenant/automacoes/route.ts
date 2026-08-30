import { z } from 'zod'

import { NIVEIS } from '@/core/automacoes/catalogo'
import { contextoAtual } from '@/server/auth/tenant'
import { exigirPermissao } from '@/server/auth/rbac'
import { writeAudit } from '@/server/audit/write'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { rota } from '@/server/http/handler'
import { lerCorpo } from '@/server/http/body'
import { definirNivelDeAutomacao } from '@/server/services/automacoes'

const Esquema = z.object({
  chave: z.string().min(1),
  nivel: z.union([z.literal(NIVEIS[0]), z.literal(NIVEIS[1]), z.literal(NIVEIS[2])]),
})

/**
 * `PATCH /api/v1/tenant/automacoes` — muda o nível de UMA automação.
 *
 * `tenant:update` (só o dono, mesma da rota `/tenant`) e não permissão de leitura: subir o nível de autonomia é decisão do dono,
 * não de quem atende. O teto por automação é aplicado no serviço (`definirNivelDeAutomacao`),
 * não aqui e não na tela — um PATCH montado à mão não pode pôr campanha em nível 3.
 */
export const PATCH = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const { chave, nivel } = await lerCorpo(req, Esquema)
  const db = await criarClienteDoUsuario()

  const config = await definirNivelDeAutomacao(db, ctx.tenantId, chave as never, nivel)

  // Mudança de autonomia é exatamente o tipo de coisa que precisa ficar registrada: sem clique
  // humano depois, o log é a única prova de quem ligou e quando (`docs/33 §6` item 2).
  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'tenant.automacao_nivel',
      entity: 'tenant',
      after: { chave, nivel },
      requestId,
    },
    req,
  )

  return config
})
