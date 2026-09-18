import { headers } from 'next/headers'
import Link from 'next/link'

import BloqueioPlano from '@/components/ui/bloqueio-plano'
import { podeUsarModulo } from '@/core/billing/planos'
import { ehRequisicaoDoAppNativo } from '@/core/plataforma/nativo'
import { avaliarPermissao } from '@/server/auth/rbac'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { margensDoClube, raioXDeRecorrencia, receitaContratadaDoMes } from '@/server/services/clube'
import { lerConfigFidelidade, listarPlanos } from '@/server/services/fidelidade'
import { contextoDePlano } from '@/server/services/planos'

import EditorFidelidade from './fidelidade-config'
import EditorPlanos from './editor'
import MargemDoClube from './margem-do-clube'
import RaioXRecorrencia from './raio-x-recorrencia'
import ReceitaContratada from './receita-contratada'
import PageHeader from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export const metadata = { title: "Fidelidade e assinatura" }

export default async function PaginaPlanos() {
  const cabecalhos = await headers()
  const ctx = await contextoDoPainel(new Request('https://interno/config/planos', { headers: cabecalhos }))
  const db = await criarClienteDoUsuario()
  // T1.5 (docs/64 §0.2): a versão nativa não pode oferecer caminho pra pagar.
  const nativo = ehRequisicaoDoAppNativo(cabecalhos.get('user-agent'))
  /*
   * `docs/48` §4.6: margem por assinante é dinheiro do negócio, e a mesma regra do caixa vale
   * aqui — `professional` e `reception` não têm `report:read`. O resto da tela (planos e pontos)
   * continua aberto a quem administra o catálogo.
   */
  const podeVerMargem = avaliarPermissao(ctx.papel, 'report:read') !== null

  const [planos, negocio, plano, margens, raioX, receitaContratadaCents] = await Promise.all([
    listarPlanos(db, ctx.tenantId),
    db.from('tenants').select('settings').eq('id', ctx.tenantId).single(),
    contextoDePlano(db, ctx.tenantId),
    podeVerMargem ? margensDoClube(db, ctx.tenantId, ctx.tenant.timezone) : Promise.resolve([]),
    raioXDeRecorrencia(db, ctx.tenantId),
    podeVerMargem ? receitaContratadaDoMes(db, ctx.tenantId) : Promise.resolve(null),
  ])

  /*
   * `PUT /api/v1/tenant/loyalty-config` exige o módulo `loyalty` (Equipe), e esta tela inteira é o
   * editor daquela config. Sem a trava, quem está no Grátis ou no Essencial ajustava pontos por
   * real, bônus de indicação e prêmio, tocava em Salvar e só então a rota recusava.
   *
   * `docs/30` §5.2 é a razão de o desenho ser este e não "sumir com a tela": ver a fidelidade
   * acontecendo é o que gera a pressão de upgrade. O que o Equipe vende é o automático.
   */
  const bloqueado = podeUsarModulo(plano, 'loyalty').estado !== 'liberado'
  /*
   * `POST /api/v1/subscription-plans` e `POST /api/v1/clients/[id]/subscription` exigem o módulo
   * `club` (Avançado). Sem esta trava, qualquer tenant criava e vendia "Planos mensais" de graça —
   * a mesma classe de buraco que a auditoria de 26/08 achou em Comanda, Equipe, Fidelidade e
   * Recorrência (`docs/23` §7), só que nesta aqui ninguém tinha olhado ainda.
   */
  const bloqueadoClube = podeUsarModulo(plano, 'club').estado !== 'liberado'

  return (
    <>
      <PageHeader titulo="Fidelidade e assinatura" descricao="Como o cliente ganha pontos e os planos mensais que pode assinar." />

      {bloqueado ? (
        <BloqueioPlano
          nativo={nativo}
          className="mb-4"
          precisaDo="equipe"
          acao="creditar os pontos sozinho, a cada atendimento concluído"
          alternativa={<Link href="/admin/clientes">Continuar dando desconto na mão</Link>}
        />
      ) : null}

      <RaioXRecorrencia raioX={raioX} />

      <EditorFidelidade inicial={lerConfigFidelidade(negocio.data?.settings)} bloqueado={bloqueado} />
      <div className="mt-7">
        <p className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Planos mensais</p>
        {bloqueadoClube ? (
          <BloqueioPlano
            nativo={nativo}
            className="mb-4"
            precisaDo="avancado"
            acao="vender assinatura mensal de atendimento, com cobrança recorrente do cliente"
            alternativa={<Link href="/admin/clientes">Continuar cobrando por atendimento avulso</Link>}
          />
        ) : null}
        <EditorPlanos iniciais={planos} bloqueado={bloqueadoClube} />
        {receitaContratadaCents !== null ? <ReceitaContratada cents={receitaContratadaCents} /> : null}
      </div>

      <MargemDoClube margens={margens} />
    </>
  )
}
