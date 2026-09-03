import { headers } from 'next/headers'

import BloqueioPlano from '@/components/ui/bloqueio-plano'
import { podeUsarModulo } from '@/core/billing/planos'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarOrcamentos } from '@/server/services/orcamentos'
import { contextoDePlano } from '@/server/services/planos'

import ListaOrcamentos from './lista'
import PageHeader from '@/components/ui/page-header'

export const metadata = { title: "Orçamentos" }

export default async function PaginaOrcamentos() {
  const ctx = await contextoAtual(new Request('https://interno/orcamentos', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [orcamentos, plano] = await Promise.all([listarOrcamentos(db, ctx.tenantId), contextoDePlano(db, ctx.tenantId)])

  /*
   * `quotes` é do Essencial, e `POST /api/v1/quotes` exige o módulo. O caminho até aqui já era
   * inteiro: o hub mostra "Orçamentos", o estado vazio convida a criar, a ficha da cliente tem o
   * botão — e o formulário só recusava no envio, com o orçamento todo montado.
   *
   * Sem evidência numérica de propósito: o argumento do orçamento não é quantidade, é o link que a
   * cliente abre e responde. `BloqueioPlano` sem `evidencia` usa o molde "Para {ação}, é preciso o
   * {plano}", que é o certo aqui.
   */
  const bloqueado = podeUsarModulo(plano, 'quotes').estado !== 'liberado'

  return (
    <>
      <PageHeader titulo="Orçamentos" descricao={`${orcamentos.length} ${orcamentos.length === 1 ? 'orçamento' : 'orçamentos'}`} />
      {bloqueado ? (
        <BloqueioPlano
          className="mb-4"
          precisaDo="essencial"
          acao="montar um orçamento e mandar o link para a cliente responder"
        />
      ) : null}
      <ListaOrcamentos orcamentos={orcamentos} bloqueado={bloqueado} />
    </>
  )
}
