import { headers } from 'next/headers'
import Link from 'next/link'
import { ChevronRight, FlaskConical, Lock } from 'lucide-react'
import { Temporal } from '@js-temporal/polyfill'

import EmptyState from '@/components/ui/empty-state'
import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import { RELATORIO_DA_EQUIPE, avaliarPermissao } from '@/server/auth/rbac'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { montarMapaDeVazamento } from '@/core/caixa/mapa-de-vazamento'
import { concentracaoDoMes, margemDosServicos, resumoMensal, serieMensalDeLucro, taxaPorFormaDoMes } from '@/server/services/caixa'
import { margensDoClube } from '@/server/services/clube'
import { lerCustoFixoDoTenant } from '@/server/services/custo-fixo'
import { medirMaterialDoCatalogo } from '@/server/services/ficha-de-consumo'
import { procurasEmDiaFechado } from '@/server/services/demanda-nao-atendida'
import { diaMaisOciosoDoTenant } from '@/server/services/ociosidade'
import { prestacaoDeContasDoMotor } from '@/server/services/previsao'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { listarServicos } from '@/server/services/servicos'

import MapaDeVazamento from './mapa-de-vazamento'
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
  const ctx = await contextoDoPainel(new Request('https://interno/mes', { headers: await headers() }))
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

  const [mensal, concentracao, recuperar, motor, material, serie, custoFixo, taxa, diaOcioso, clube, margens, servicos, procuras] = await Promise.all([
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
    // `docs/53` D-01 — o dia da semana que está consistentemente vazio, SÓ o fato. Nunca um
    // preço nem uma sugestão de desconto: essa fronteira é do próprio módulo (`core/agenda/
    // ociosidade.ts`), e é o que separa isto de precificação automática, vedada pelo `CLAUDE.md`.
    diaMaisOciosoDoTenant(db, ctx.tenantId, timezone, hoje.toString()),
    // docs/84 Aposta B — o mapa de vazamento. Os quatro abaixo são o que ele usa além do que esta
    // página já busca (recuperar, dia ocioso): mesmas funções das telas do clube e dos serviços.
    margensDoClube(db, ctx.tenantId, timezone),
    margemDosServicos(db, ctx.tenantId, timezone, hoje.toString()),
    // Nome dos serviços, e só dos ATIVOS: arquivado sai das telas de dinheiro (0093).
    listarServicos(db, ctx.tenantId),
    procurasEmDiaFechado(db, ctx.tenantId, hoje.toString()),
  ])

  const nomeDoServico = new Map(servicos.map((s) => [s.id, s.name]))
  const vazamentos = montarMapaDeVazamento({
    // O MESMO número do cartão "Parado em quem sumiu" logo abaixo — lucro, não receita.
    recuperar: { pessoas: recuperar.count, lucroCents: recuperar.totalProfitCents },
    clube,
    servicosAbaixoDoPiso: margens.flatMap((m) =>
      m.parcelaDominante && nomeDoServico.has(m.serviceId) ? [{ nome: nomeDoServico.get(m.serviceId)!, parcela: m.parcelaDominante }] : [],
    ),
    procurasEmDiaFechado: procuras,
    diaOcioso,
  })

  return (
    <>
      <PageHeader
        titulo="O mês"
        descricao="O que entrou, o que sobrou, de quem depende, o que está parado e o quanto o Motor acertou."
      />

      <MapaDeVazamento linhas={vazamentos} />

      {/*
        docs/84 Aposta C — depois de ver onde escapa, testar a mudança antes de decidir. Link, não
        bloco: a tela do mês já é a mais cheia do painel, e o teste mora na própria tela.
      */}
      <Link href="/admin/experimentos" className="mb-6 block">
        <Card pressionavel className="flex items-center gap-3">
          <FlaskConical aria-hidden className="size-5 shrink-0 text-acc-2" />
          <div className="min-w-0 flex-1">
            <p className="text-corpo font-semibold">Testar antes de decidir</p>
            <p className="text-secundario text-txt-2">Mude uma coisa por alguns dias e compare com os mesmos dias de antes.</p>
          </div>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-txt-3" />
        </Card>
      </Link>

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
        diaOcioso={diaOcioso}
      />
    </>
  )
}
