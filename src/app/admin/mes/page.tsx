import { headers } from 'next/headers'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Temporal } from '@js-temporal/polyfill'

import EmptyState from '@/components/ui/empty-state'
import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import { RELATORIO_DA_EQUIPE, avaliarPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { concentracaoDoMes, resumoMensal, serieMensalDeLucro, taxaPorFormaDoMes } from '@/server/services/caixa'
import { lerCustoFixoDoTenant } from '@/server/services/custo-fixo'
import { medirMaterialDoCatalogo } from '@/server/services/ficha-de-consumo'
import { prestacaoDeContasDoMotor } from '@/server/services/previsao'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'

import ResumoDoMes from './resumo'

export const metadata = { title: 'O mês' }

/**
 * `docs/50` L-07 — o artefato que o dono abre uma vez por mês e mostra para alguém.
 *
 * Cinco números que **já existem**, em cinco telas diferentes. Esta página não calcula nenhum
 * deles: ela compõe. O critério 3 do ticket é literal sobre isso, e a razão é a de sempre nesta
 * base — um sexto lugar calculando lucro seria a segunda fonte da mesma verdade, e a tela do mês
 * discordaria do caixa sem que ninguém entendesse por quê.
 *
 * As cinco consultas saem no mesmo `Promise.all`. Em série seriam cinco idas de rede numa tela que
 * o dono abre justamente para ter a visão rápida.
 */
export default async function PaginaDoMes() {
  const ctx = await contextoAtual(new Request('https://interno/mes', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  // Mesma trava do caixa (§3.3/§4.6): `professional` e `reception` não têm `report:read`. A RLS é
  // a rede embaixo; isto é a primeira camada, para a tela não abrir vazia sem dizer o porquê.
  if (!avaliarPermissao(ctx.papel, 'report:read')) {
    return (
      <>
        <PageHeader titulo="O mês" />
        <Card className="p-0">
          <EmptyState
            icone={<Lock aria-hidden className="size-6" />}
            titulo="Você não tem acesso ao resumo do mês"
            descricao="Só quem cuida do financeiro do negócio vê o fechamento. Peça ao dono se precisar."
            acao={<Link href="/admin/hoje">Voltar para Hoje</Link>}
          />
        </Card>
      </>
    )
  }

  const timezone = ctx.tenant.timezone
  const hoje = Temporal.Now.instant().toZonedDateTimeISO(timezone).toPlainDate()
  const mes = `${hoje.year}-${String(hoje.month).padStart(2, '0')}`

  const [mensal, concentracao, recuperar, motor, material, serie, custoFixo, taxa] = await Promise.all([
    resumoMensal(db, ctx.tenantId, timezone, mes),
    // Mesma trava do caixa (`docs/50` L-10): sem `report:team` o número "de quem depende" não sai,
    // e a consulta nem acontece.
    avaliarPermissao(ctx.papel, RELATORIO_DA_EQUIPE) ? concentracaoDoMes(db, ctx.tenantId, timezone, mes) : null,
    listarParaRecuperar(db, ctx.tenantId),
    prestacaoDeContasDoMotor(db, ctx.tenantId, hoje.toString()),
    /*
     * O sexto, e ele não é um dos cinco números: é a ressalva sobre o segundo. Sem o custo do
     * produto registrado, o "sobrou" do mês sai otimista, e um resumo que o dono MOSTRA para
     * alguém é o pior lugar possível para um número sem ressalva.
     */
    medirMaterialDoCatalogo(db, ctx.tenantId),
    /*
     * `docs/50` L-09. Além de LER a série, esta chamada é quem CONGELA os meses já encerrados que
     * ainda não tinham linha — a primeira abertura da tela depois do virar do mês. Ver o cabeçalho
     * de `serieMensalDeLucro` para o porquê de não ser um cron.
     */
    serieMensalDeLucro(db, ctx.tenantId, timezone, hoje.toString()),
    lerCustoFixoDoTenant(db, ctx.tenantId),
    // `docs/53` A-01 — o que a forma de pagamento custou, e o que as outras que o salão já usa
    // teriam custado no mesmo volume. Sétimo, e não um dos cinco: é a razão por trás do "Sobrou".
    taxaPorFormaDoMes(db, ctx.tenantId, timezone, mes),
  ])

  return (
    <>
      <PageHeader
        titulo="O mês"
        descricao="O que entrou, o que sobrou, de quem depende, o que está parado e o quanto o Motor acertou."
      />

      <ResumoDoMes
        mes={mes}
        entrouCents={mensal.revenueCents}
        sobrouCents={mensal.profitCents}
        comandas={mensal.ticketsCount}
        concentracao={concentracao}
        paradoCents={recuperar.totalProfitCents}
        clientesParados={recuperar.count}
        motor={motor}
        servicosSemMaterial={material.semFicha + material.comProdutoSemCusto}
        custoFixoRespondido={custoFixo.respondido}
        serie={serie}
        taxa={taxa}
      />
    </>
  )
}
