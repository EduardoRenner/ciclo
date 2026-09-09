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
    Unidade 10. Era `client:read`, que a RECEPÇÃO tem — e esta rota DECIFRA o cofre e devolve as
    respostas da anamnese em texto claro. Era, na prática, a porta mais larga para o dado de saúde
    do produto inteiro: mais larga que `/vault`, que exige `vault:own` + AAL2 + trilha.

    **Por que `client:export`, e a ressalva honesta.** A permissão já existia em
    `EXCLUSIVAS_DO_DONO`, mas o `rbac.ts` a justifica pela C35 da FAQ — que pergunta "quem pode
    exportar A BASE de clientes", ou seja, a carteira inteira. Esta rota é outra coisa: a ficha de
    UMA cliente, para o direito de acesso da LGPD. Reusar a permissão é decisão desta rodada, não
    herança; a C35 não decide por ela.

    O piso que decide é outro, e é mais simples: **o que sai daqui contém o que o `/vault` protege**,
    então a porta não pode ser mais larga que a dele. `vault:own` (dono + profissional) seria o
    mínimo coerente. Ficou no dono, um degrau acima, porque exportar produz um ARQUIVO que sai do
    sistema — e porque errar restritivo se conserta com um clique do dono, enquanto errar permissivo
    já vazou. Se um salão com gerente reclamar da fricção, `vault:own` é o afrouxamento certo.

    O `exigirAal2()` abaixo é o "MFA na hora". O limite de 1×/mês da C35 é da exportação em massa e
    NÃO se aplica aqui — um titular pode pedir os próprios dados quantas vezes quiser.
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
