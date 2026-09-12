import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { cadastrarQuemJaAtendo, EsquemaQuemJaAtendo } from '@/server/services/quem-ja-atendo'

/**
 * Cadastra de uma vez a clientela que o salão já atendia antes do CICLO, com a última visita
 * respondida de memória.
 *
 * `client:create` e não `client:update`: a operação é criar ficha em lote — a mesma autoridade da
 * importação por planilha (`clients/import`), que é a outra porta para a mesma coisa. Recepção tem
 * `client:create`, e faz sentido: quem atende o balcão é quem sabe quem é cliente da casa.
 *
 * `comIdempotencia` importa mais aqui do que numa criação avulsa: a tela manda uma lista inteira, e
 * um toque duplicado no botão (ou uma rede ruim que reenvia) criaria a base do salão em dobro.
 */
export const POST = rota(async (req, _params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:create')

  const entrada = await lerCorpo(req, EsquemaQuemJaAtendo)
  const db = await criarClienteDoUsuario()

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/clients/ja-atendo' }, () =>
    cadastrarQuemJaAtendo(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'client.ja_atendo',
      entity: 'clients',
      // Sem nome nem telefone na trilha: o `after` do audit vira `jsonb` e já foi ponto cego de LGPD
      // uma vez (`docs/…`, achado de 2026-08-28). O contador basta para auditar a ação.
      after: {
        cadastrados: resultado.cadastrados,
        jaExistiam: resultado.jaExistiam.length,
        cyclesGravados: resultado.previsao?.cyclesGravados ?? 0,
      },
      requestId,
    },
    req,
  )

  return resultado
})
