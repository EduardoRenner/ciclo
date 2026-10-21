import { z } from 'zod'

import { confirmacaoParaExcluir } from '@/core/auth/confirmar-exclusao'
import { writeAudit } from '@/server/audit/write'
import { contextoDeReautenticacao, senhaConfere } from '@/server/auth/session'
import { withNovoTenant } from '@/server/db/with-tenant'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { excluirPropriaConta, situacaoDaConta } from '@/server/services/conta'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { limitador } from '@/server/services/rate-limit'

/**
 * T-DEL (docs/64 §0.3). `GET` é a checagem — a tela de confirmação lê isto ANTES de mostrar o
 * botão final, pra dizer com clareza o que vai acontecer (ou por que não pode acontecer ainda).
 * `DELETE` é a ação de verdade. Era atrás de `exigirAal2()` para todo mundo; desde LOJA-27
 * (docs/98-aprimoramento/11) a confirmação é proporcional ao que a conta tem (`core/auth/confirmar-exclusao.ts`):
 * segundo fator para quem o cadastrou, login recente ou senha para quem não.
 */
const EsquemaConfirmacao = z.object({ password: z.string().min(1).max(200).optional() }).strict()

/** 5 tentativas de senha em 15 minutos por conta: confirmar não pode virar porta de adivinhar senha. */
const LIMITE_DE_SENHA = { limite: 5, janelaSegundos: 900 }

export const GET = rota(async () => {
  const c = await contextoDeReautenticacao()
  const situacao = await withNovoTenant((svc) => situacaoDaConta(svc, c.sessao.userId))
  return { ...situacao, confirmacao: confirmacaoParaExcluir({ ...c, aal: c.sessao.aal, agoraMs: Date.now() }) }
})

export const DELETE = rota(async (req, _ctx, requestId) => {
  const c = await contextoDeReautenticacao()
  const sessao = c.sessao
  const confirmacao = confirmacaoParaExcluir({ ...c, aal: sessao.aal, agoraMs: Date.now() })
  if (confirmacao === 'segundo_fator') throw new AppError('MFA_REQUIRED')
  if (confirmacao === 'entrar_de_novo') {
    throw new AppError('REAUTH_REQUIRED', { message: 'Por segurança, saia e entre de novo para excluir sua conta.' })
  }
  if (confirmacao === 'senha') {
    const { password } = (await req.clone().text()) ? await lerCorpo(req, EsquemaConfirmacao) : { password: undefined }
    if (!password) throw new AppError('REAUTH_REQUIRED')
    const tentativa = await limitador(`excluir-conta:senha:${sessao.userId}`, LIMITE_DE_SENHA)
    if (!tentativa.permitido) throw AppError.limiteDeTaxa(LIMITE_DE_SENHA.janelaSegundos)
    if (!(await senhaConfere(sessao.email, password))) throw AppError.validacao({ password: 'Senha incorreta.' })
  }

  // A idempotência grava o hash do pedido no banco: a senha não pode estar nele. Daqui para baixo o corpo não
  // importa (a confirmação já foi feita acima, e é refeita em cada repetição).
  const semCorpo = new Request(req.url, { method: req.method, headers: req.headers })

  // Não existe um `tenantId` único aqui — a exclusão pode atingir zero, um ou vários negócios ao
  // mesmo tempo. `idempotency_keys.tenant_id` não tem FK (migration 0001): é só o prefixo que evita
  // colisão de chave entre pedidos concorrentes (`server/http/idempotency.ts`), então o próprio
  // `userId` serve igual a um tenant de verdade pra esse propósito — a fila offline não pode
  // reenviar esta exclusão duas vezes sem que a segunda vez devolva a mesma resposta da primeira.
  // BL-42: o laço de writeAudit também fica DENTRO do fechamento — fora dele, uma repetição não só
  // duplicaria UMA linha, duplicaria uma por vínculo (quem é `professional` em dois salões, por
  // exemplo).
  await comIdempotencia(semCorpo, { tenantId: sessao.userId, endpoint: '/api/v1/account' }, async () => {
    const vinculos = await withNovoTenant((svc) => excluirPropriaConta(svc, sessao.userId))
    // Um registro por tenant onde a conta tinha vínculo — `writeAudit` exige `tenantId`. Grava
    // DEPOIS de excluir de propósito: `actor_id` em `audit_log` não tem FK pra `auth.users`
    // (migration 0001), então não há corrida com a exclusão já ter acontecido.
    for (const vinculo of vinculos) {
      await writeAudit(
        {
          tenantId: vinculo.tenantId,
          actorId: sessao.userId,
          actorRole: vinculo.role,
          action: 'account.self_delete',
          entity: 'memberships',
          entityId: sessao.userId,
          requestId,
        },
        semCorpo,
      )
    }
    return vinculos
  })

  return { deleted: true }
})
