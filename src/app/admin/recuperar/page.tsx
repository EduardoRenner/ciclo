import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { Temporal } from '@js-temporal/polyfill'

import { podeUsarCapacidade } from '@/core/billing/planos'
import AlertBanner from '@/components/ui/alert-banner'
import PageHeader from '@/components/ui/page-header'
import { dinheiro } from '@/lib/formato'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDePlano } from '@/server/services/planos'
import { prestacaoDeContasDoMotor } from '@/server/services/previsao'
import { medirMaterialDoCatalogo } from '@/server/services/ficha-de-consumo'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { receitaAtribuidaAoCiclo } from '@/server/services/atribuicao'

import PrestacaoDeContasDoMotor from './prestacao'
import RecuperarReceita from './recuperar'

export const metadata = { title: "Recuperar receita" }

export default async function PaginaRecuperar() {
  const ctx = await contextoAtual(new Request('https://interno/recuperar', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  // `docs/28` §8: o `timezone` chega no contexto, sem segunda ida ao banco.
  const timezone = ctx.tenant.timezone
  const mesAtual = Temporal.PlainYearMonth.from(Temporal.Now.zonedDateTimeISO(timezone).toPlainDate())
  const desde = mesAtual.toPlainDate({ day: 1 }).toString()
  const ate = mesAtual.toPlainDate({ day: mesAtual.daysInMonth }).toString()

  /*
   * As TRÊS contagens existem para o ESTADO VAZIO saber o que dizer, e a primeira dupla entrou
   * quando esta tela virou o botão central da barra (31/08): antes ela era um destino de canto,
   * agora é a primeira coisa que um salão novo toca. "Ninguém para recuperar" sem mais nada é a
   * mesma frase para QUATRO situações completamente diferentes — sem cliente cadastrada, sem
   * atendimento concluído, com atendimento mas o Motor ainda não processou, e tudo em dia — e só a
   * última é boa notícia.
   *
   * São `head: true` com `count: 'exact'`: não trazem linha nenhuma, só o número, e vão no mesmo
   * `Promise.all` que já existia — custo de latência zero contra o que a tela já pagava.
   */
  const [lista, atribuicao, plano, clientes, ciclos, concluidos, contasDoMotor, material] = await Promise.all([
    listarParaRecuperar(db, ctx.tenantId),
    receitaAtribuidaAoCiclo(db, ctx.tenantId, timezone, desde, ate),
    contextoDePlano(db, ctx.tenantId),
    db.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', ctx.tenantId).is('deleted_at', null),
    db.from('client_cycles').select('client_id', { count: 'exact', head: true }).eq('tenant_id', ctx.tenantId),
    /*
     * A quarta contagem separa "ainda não atendeu ninguém" de "atendeu e o Motor não processou".
     * Sem ela, quem já concluiu centenas de atendimentos lia "assim que você concluir um
     * atendimento" — o produto pedindo de volta um trabalho já feito e escondendo que o job é que
     * estava parado. Aconteceu de verdade: cron apontando para uma URL que deixou de existir.
     */
    db
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId)
      .eq('status', 'done'),
    /*
      `docs/48` C5. Lê `cycle_predictions` (append-only desde a `0064`) e devolve o quanto o Motor
      acertou contra o que ele mesmo disse ANTES de saber. Entra no mesmo `Promise.all` — latência
      somada: zero.
    */
    prestacaoDeContasDoMotor(db, ctx.tenantId, Temporal.Now.zonedDateTimeISO(timezone).toPlainDate().toString()),
    /*
      A lacuna do material, no mesmo `Promise.all`. Ela não é enfeite nesta tela: o lucro é o que
      ORDENA a fila, e sem custo de produto uma coloração parece tão lucrativa quanto um corte do
      mesmo preço — o dono gastaria o WhatsApp do dia com quem vale menos, que é exatamente o que
      a `0067` veio consertar.
    */
    medirMaterialDoCatalogo(db, ctx.tenantId),
  ])

  // A tela precisa saber para desenhar o caminho certo; quem RECUSA é a rota (§L.1). Aqui é
  // desenho, não segurança.
  const podeEnviarEmLote = podeUsarCapacidade(plano, 'envio_em_lote').estado === 'liberado'

  return (
    <>
      {/*
        Campanha mora no hub de "Configurações" — que é onde se ajusta o negócio,
        não onde se trabalha. Quem está nesta tela é exatamente quem quer chamar
        gente de volta em lote e ver quanto voltou; o atalho vive aqui, sem
        precisar mudar a arquitetura de navegação inteira por causa de dois itens.
      */}
      <PageHeader
        titulo="Recuperar receita"
        descricao="Quem o Motor de Ciclo identificou em atraso para voltar."
        acao={
          <Link
            href="/admin/campanhas"
            className="flex h-12 items-center gap-1 text-label font-semibold text-acc-2 transition active:scale-[.97]"
          >
            Campanhas
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        }
      />

      {atribuicao.count > 0 ? (
        <AlertBanner className="mb-5">
          O Motor de Ciclo trouxe{' '}
          <strong className="font-bold text-acc-2">{dinheiro.format(atribuicao.totalCents / 100)}</strong> este mês (
          {atribuicao.count} {atribuicao.count === 1 ? 'agendamento' : 'agendamentos'}).
        </AlertBanner>
      ) : null}

      <PrestacaoDeContasDoMotor contas={contasDoMotor} />

      <RecuperarReceita
        inicial={lista}
        podeEnviarEmLote={podeEnviarEmLote}
        temClientes={(clientes.count ?? 0) > 0}
        temCiclos={(ciclos.count ?? 0) > 0}
        temAtendimentosConcluidos={(concluidos.count ?? 0) > 0}
        servicosSemMaterial={material.semFicha + material.comProdutoSemCusto}
      />
    </>
  )
}
