import { Temporal } from '@js-temporal/polyfill'

import { avaliarPermissao } from '@/server/auth/rbac'
import { comMaiuscula, plural } from '@/core/text/vocabulario'
import { contextoDoPainel } from '@/server/auth/tenant'
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
  const ctx = await contextoDoPainel(new Request('https://interno/config/servicos', { headers: await headers() }))
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
    /*
     * APR-010: a margem é coluna extra. Se ela falhar, a lista de serviços abre sem ela e com aviso
     * — antes, um 414 desta consulta levava a tela inteira para "Não consegui carregar".
     */
    podeVerLucro
      ? margemDosServicos(db, ctx.tenantId, ctx.tenant.timezone, hoje).catch((erro: unknown) => {
          console.warn(JSON.stringify({ level: 'warn', event: 'margem_dos_servicos_falhou', tenantId: ctx.tenantId, tela: 'servicos' }), erro)
          return null
        })
      : [],
  ])

  return (
    <>
      <PageHeader titulo={comMaiuscula(plural(ctx.tenant.vocabulario.servico))} descricao="O que você oferece, quanto dura e quanto custa. Arraste para mudar a ordem que aparece na sua página." />

      {margens === null && <p className="mb-4 text-secundario text-txt-2">Não consegui conferir a margem dos serviços agora. O resto está certo; abra de novo daqui a pouco.</p>}
      <ListaServicos iniciais={servicos} margens={margens ?? []} podeVerLucro={podeVerLucro} />
    </>
  )
}
