import { ipDe } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { withTenant } from '@/server/db/with-tenant'
import { exportarDadosDoCliente } from '@/server/services/lgpd'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** §2.7 `GET .../data-export → JSON (direito de acesso/portabilidade)`. */
export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  /*
    Unidade 10. Era `client:read`, que a RECEPÇÃO tem — e esta rota decifra o cofre e devolve as
    respostas da anamnese em texto claro. Exportar era, na prática, a porta mais larga para o dado
    de saúde do produto inteiro: mais larga que `/vault`, que exige `vault:own`.

    `client:export` não é permissão nova: o próprio `rbac.ts` já a reserva ao dono em
    `EXCLUSIVAS_DO_DONO`, citando a C35 da FAQ ("só owner, com MFA na hora, no máximo 1×/mês").
    A decisão existia e a rota não a aplicava. O `exigirAal2()` da linha de baixo já cobria o
    "MFA na hora"; o limite mensal continua sem implementação, e isso está anotado no DECISOES.
  */
  exigirPermissao(ctx.papel, 'client:export')
  const sessao = await exigirAal2()

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })

  // `withTenant` e não o cliente do usuário: a `0077` tirou `ciphertext`/`iv`/`auth_tag` do
  // `grant select` de `authenticated`, então a leitura do cofre passa pelo service_role — depois
  // da permissão acima, nunca antes. O `tenant_id` segue filtrado na mão dentro do serviço.
  return withTenant(ctx.tenantId, (db, tenantId) =>
    exportarDadosDoCliente(db, tenantId, id, {
      actorId: sessao.userId,
      ip: ipDe(req),
      userAgent: req.headers.get('user-agent')?.slice(0, 400) ?? null,
    }),
  )
})
