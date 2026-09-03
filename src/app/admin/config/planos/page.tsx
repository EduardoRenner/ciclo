import { headers } from 'next/headers'
import Link from 'next/link'

import BloqueioPlano from '@/components/ui/bloqueio-plano'
import { podeUsarModulo } from '@/core/billing/planos'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerConfigFidelidade, listarPlanos } from '@/server/services/fidelidade'
import { contextoDePlano } from '@/server/services/planos'

import EditorFidelidade from './fidelidade-config'
import EditorPlanos from './editor'
import PageHeader from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export const metadata = { title: "Fidelidade e assinatura" }

export default async function PaginaPlanos() {
  const ctx = await contextoAtual(new Request('https://interno/config/planos', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const [planos, negocio, plano] = await Promise.all([
    listarPlanos(db, ctx.tenantId),
    db.from('tenants').select('settings').eq('id', ctx.tenantId).single(),
    contextoDePlano(db, ctx.tenantId),
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

  return (
    <>
      <PageHeader titulo="Fidelidade e assinatura" descricao="Como o cliente ganha pontos e os planos mensais que pode assinar." />

      {bloqueado ? (
        <BloqueioPlano
          className="mb-4"
          precisaDo="equipe"
          acao="creditar os pontos sozinho, a cada atendimento concluído"
          alternativa={<Link href="/admin/clientes">Continuar dando desconto na mão</Link>}
        />
      ) : null}

      <EditorFidelidade inicial={lerConfigFidelidade(negocio.data?.settings)} bloqueado={bloqueado} />
      <div className="mt-7">
        <p className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Planos mensais</p>
        <EditorPlanos iniciais={planos} />
      </div>
    </>
  )
}
