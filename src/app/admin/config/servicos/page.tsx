import { Temporal } from '@js-temporal/polyfill'

import { avaliarPermissao } from '@/server/auth/rbac'
import { comMaiuscula, plural } from '@/core/text/vocabulario'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { margemDosServicos } from '@/server/services/caixa'
import { listarServicos } from '@/server/services/servicos'
import { headers } from 'next/headers'

import ListaServicos from './lista'
import PageHeader from '@/components/ui/page-header'

export const metadata = { title: "Serviços" }

/**
 * Server Component: a lista chega pronta no primeiro paint (§10 pede LCP < 2s
 * no 4G). A interação — arquivar, reordenar — é do componente cliente.
 */
export default async function PaginaServicos() {
  const ctx = await contextoAtual(new Request('https://interno/config/servicos', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  /*
   * `docs/50` L-06, critério 4: a margem por serviço é dinheiro do negócio, atrás de `report:read`
   * como o resto da família (§4.6). Sem a permissão a consulta nem acontece — a lista de serviços
   * continua inteira, só sem a coluna de margem.
   */
  const podeVerLucro = avaliarPermissao(ctx.papel, 'report:read') !== null
  const hoje = Temporal.Now.zonedDateTimeISO(ctx.tenant.timezone).toPlainDate().toString()

  const [servicos, margens] = await Promise.all([
    listarServicos(db, ctx.tenantId, true),
    podeVerLucro ? margemDosServicos(db, ctx.tenantId, ctx.tenant.timezone, hoje) : [],
  ])

  return (
    <>
      <PageHeader titulo={comMaiuscula(plural(ctx.tenant.vocabulario.servico))} descricao="O que você oferece, quanto dura e quanto custa. Arraste para mudar a ordem que a cliente vê." />

      <ListaServicos iniciais={servicos} margens={margens} podeVerLucro={podeVerLucro} />
    </>
  )
}
