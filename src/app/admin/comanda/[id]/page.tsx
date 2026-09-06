import { headers } from 'next/headers'

import { podeUsarModulo } from '@/core/billing/planos'
import { CATALOGO_DE_SERVICOS, destinoDoMaterial } from '@/core/comanda/completude-do-lucro'
import { custoFixoEstaConfigurado } from '@/core/comanda/custo-fixo'
import { explicarSobra } from '@/core/comanda/sobra-explicada'
import { avaliarPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { buscarComanda } from '@/server/services/comanda'
import { contextoDePlano } from '@/server/services/planos'
import { listarServicos } from '@/server/services/servicos'
import { lerTaxasDoTenant } from '@/server/services/taxas-de-pagamento'

import PageHeader from '@/components/ui/page-header'

import Comanda from './comanda'

export const metadata = { title: "Comanda" }

export default async function PaginaComanda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await contextoAtual(new Request('https://interno/comanda', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [{ ticket, items }, servicos, plano] = await Promise.all([
    buscarComanda(db, ctx.tenantId, id),
    listarServicos(db, ctx.tenantId),
    contextoDePlano(db, ctx.tenantId),
  ])

  /*
   * `POST /api/v1/tickets/[id]/items` exige o módulo `register` (Essencial). A comanda abre para
   * todo mundo — é a tela que a agenda oferece ao concluir o atendimento — e sem a trava a pessoa
   * escolhia serviço e quantidade, tocava em Adicionar, e a rota recusava com o cliente na frente.
   *
   * Travar no botão, e não esconder a tela: ver a comanda é o que mostra o que o Essencial faz.
   */
  const podeLancarItem = podeUsarModulo(plano, 'register').estado === 'liberado'

  /*
   * `docs/48` §4.6: o lucro por atendimento é dado sensível DENTRO do salão. Ele diz quanto a
   * comissão de quem atendeu come do serviço, e a mesma tela é aberta pelo profissional
   * comissionado (`comanda:own`). `report:read` já separa isso na tabela de `rbac.ts` — nem
   * `professional` nem `reception` o têm — e é a mesma porta que o caixa usa.
   */
  const podeVerLucro = avaliarPermissao(ctx.papel, 'report:read') !== null

  /*
   * Só para comanda FECHADA ou PAGA, e as duas exclusões importam por motivos diferentes:
   *
   * - **aberta**: a comissão ainda vale zero (ela só congela no fechamento, §5.7), então o
   *   "Sobrou" apareceria inflado exatamente enquanto a pessoa ainda pode mudar o preço;
   * - **cancelada / estornada**: os números continuam gravados na linha (a regra 11 do `CLAUDE.md`
   *   proíbe apagar; o estorno compensa, não apaga), mas aquele dinheiro não entrou. O caixa já
   *   soma só `closed`/`paid` — mostrar o "Sobrou" de uma comanda estornada faria a tela do
   *   atendimento discordar do fechamento do dia.
   */
  /*
   * `docs/50` L-02: a faixa que diz o que falta já existia; o que faltava era ela custar um toque.
   * Quando o material incerto vem de UM serviço só, o destino é a ficha dele. Com mais de um, a
   * lista do catálogo continua sendo o destino honesto — escolher um dos três esconderia os outros.
   */
  let destinoDaFicha = CATALOGO_DE_SERVICOS

  const sobra =
    podeVerLucro && (ticket.status === 'closed' || ticket.status === 'paid')
      ? await (async () => {
          const [taxas, tenantSettings] = await Promise.all([
            lerTaxasDoTenant(db, ctx.tenantId),
            // As três perguntas do custo fixo moram em `tenants.settings`, no mesmo lugar da taxa.
            db.from('tenants').select('settings').eq('id', ctx.tenantId).maybeSingle(),
          ])
          const tenant = tenantSettings.data

          /*
           * O valor CONGELADO no lançamento de cada item (`0070`), e não uma medição do catálogo de
           * hoje. Enquanto era medido agora, a comanda de agosto parava de avisar assim que o dono
           * registrasse a compra em outubro — e o `material_cost_cents` dela continuava zero. O
           * número errado ficava, o aviso sumia. "O lucro é registro, não view" vale para o valor e
           * vale para a ressalva sobre ele.
           */
          const incertos = items.filter((i) => i.material_incerto)
          const servicosIncertos = [...new Set(incertos.map((i) => i.service_id).filter((id): id is string => Boolean(id)))]
          destinoDaFicha = destinoDoMaterial(servicosIncertos)

          return explicarSobra({
            subtotalCents: ticket.subtotal_cents,
            discountCents: ticket.discount_cents,
            tipCents: ticket.tip_cents,
            materialCents: ticket.material_cost_cents,
            feeCents: ticket.fee_cents,
            commissionCents: ticket.commission_cents,
            taxaRespondida: taxas.respondida,
            itensComMaterialIncerto: incertos.length,
            fixedCostCents: ticket.fixed_cost_cents,
            custoFixoRespondido: custoFixoEstaConfigurado(tenant?.settings),
          })
        })()
      : null

  return (
    <>
      <PageHeader titulo="Comanda" descricao={ticket.status === 'open' ? 'Aberta' : 'Fechada'} />

      <Comanda
        ticketInicial={ticket}
        itensIniciais={items}
        servicos={servicos}
        podeLancarItem={podeLancarItem}
        sobra={sobra}
        destinoDoMaterial={destinoDaFicha}
      />
    </>
  )
}
