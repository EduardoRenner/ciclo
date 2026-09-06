import { Temporal } from '@js-temporal/polyfill'
import { Megaphone, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'

import BloqueioPlano from '@/components/ui/bloqueio-plano'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import SectionHeader from '@/components/ui/section-header'
import StatTile from '@/components/ui/stat-tile'
import PageHeader from '@/components/ui/page-header'
import { podeUsarModulo } from '@/core/billing/planos'
import { comMaiuscula, plural } from '@/core/text/vocabulario'
import { dinheiro } from '@/lib/formato'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { receitaAtribuidaAoCiclo, receitaPorCampanha } from '@/server/services/atribuicao'
import { contextoDePlano } from '@/server/services/planos'

export const dynamic = 'force-dynamic'


export const metadata = { title: "Campanhas" }

export default async function PaginaCampanhas() {
  const ctx = await contextoAtual(new Request('https://interno/campanhas', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const { data: campanhas } = await db
    .from('campaigns')
    // Sem `booked_count`/`revenue_cents`: ninguem escreve nelas, entao buscar era trazer zero pra tela.
    .select('id, name, template, status, sent_count, created_at')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })

  const lista = campanhas ?? []

  /*
   * Os números do topo saíam de `campaigns.booked_count` e `campaigns.revenue_cents` — colunas que
   * NINGUÉM escreve. O `insert` de `registrarCampanha` as deixa em zero de propósito ("quem
   * preenche é a atribuição, não o usuário") e a atribuição nunca escreveu de volta: não há um
   * único `update` em `campaigns` no repositório.
   *
   * O resultado não era um funil decorativo, era pior. Toda campanha aparecia com receita
   * R$ 0,00, "Marcaram horário: 0" e a frase "Cada mensagem valeu R$ 0,00 em média" — a tela
   * dizia ao salão que TODA campanha que ele já rodou não valeu nada. Estruturalmente, para
   * sempre.
   *
   * `receitaAtribuidaAoCiclo` é o número de verdade e já existe: casa mensagem de campanha
   * enviada com atendimento concluído na janela, e é a mesma função em que a tela "Hoje" confia.
   * O que ela NÃO faz é separar por campanha — `messages` não guarda de qual campanha a linha
   * saiu, então essa quebra não existe no banco. O topo passa a mostrar o real; o cartão de cada
   * campanha passa a mostrar só o que é verdade sobre ela.
   */
  const mesAtual = Temporal.PlainYearMonth.from(Temporal.Now.zonedDateTimeISO(ctx.tenant.timezone).toPlainDate())
  const atribuicao = await receitaAtribuidaAoCiclo(
    db,
    ctx.tenantId,
    ctx.tenant.timezone,
    mesAtual.toPlainDate({ day: 1 }).toString(),
    mesAtual.toPlainDate({ day: mesAtual.daysInMonth }).toString(),
  ).catch((erro: unknown) => {
    /*
      Mesmo `catch` da tela "Hoje" (`admin/hoje/page.tsx`), e aqui o silêncio custa mais: lá o zero
      só desligava o herói do Motor; aqui ele vai DIRETO para um `StatTile` que afirma "Voltaram
      este mês · R$ 0,00 · de 0 mensagens enviadas no período". Falha vira medição, com cara de
      número apurado, na tela cujo trabalho é justamente reportar resultado de campanha.
      Continua sem derrubar a tela — o que muda é deixar rastro.
    */
    console.warn(JSON.stringify({ level: 'warn', event: 'atribuicao_do_ciclo_indisponivel_em_campanhas' }), erro)
    return { totalCents: 0, count: 0, items: [], mensagensNaJanela: 0 }
  })

  /*
   * Migration 0054: agora existe o vínculo mensagem→campanha, então cada cartão pode mostrar o
   * que ele de fato trouxe — sem janela de mês, porque um cartão de campanha é registro
   * permanente, não relatório mensal (diferente do "Voltaram este mês" do topo, que É mensal).
   */
  const porCampanha = await receitaPorCampanha(db, ctx.tenantId).catch((erro: unknown) => {
    // Falhar aqui zera o resultado de TODOS os cartões de uma vez, e cada cartão é registro
    // permanente de uma campanha — "não trouxe ninguém" é uma afirmação forte para se fazer por
    // engano. Mapa vazio continua sendo a degradação certa; o que faltava era o rastro.
    console.warn(JSON.stringify({ level: 'warn', event: 'receita_por_campanha_indisponivel' }), erro)
    return new Map()
  })

  /*
   * `campaigns` é do Essencial, e o hub de Configurações manda todo mundo para cá de propósito
   * ("sumir com o item seria esconder o que dá para comprar"). Até 2026-09-03 quem chegava no
   * Grátis via um "Nova campanha" habilitado, escolhia o grupo, escrevia a mensagem, tocava em
   * enviar — e SÓ ALI a rota recusava. É o defeito que `recurso-pago-avisa-antes` descreve, na
   * tela que vende o degrau mais barato: a hora em que ela mais quer o Essencial é a hora em que
   * o produto joga fora o trabalho dela.
   *
   * A contagem da base é a evidência com o dado DELA que o §M.1 exige — e é o argumento real:
   * o que o Essencial libera aqui é alcançar essas pessoas de uma vez.
   */
  const plano = await contextoDePlano(db, ctx.tenantId)
  const bloqueado = podeUsarModulo(plano, 'campaigns').estado !== 'liberado'
  const { count: totalClientes } = bloqueado
    ? await db.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', ctx.tenantId).is('deleted_at', null)
    : { count: 0 }

  return (
    <div className="pb-8">
      <PageHeader titulo="Campanhas" descricao="Quem voltou depois de receber mensagem, e quanto isso trouxe." />

      <div className="grid grid-cols-2 gap-3">
        <StatTile rotulo="Voltaram este mês" valor={dinheiro.format(atribuicao.totalCents / 100)} />
        <StatTile
          rotulo={comMaiuscula(plural(ctx.tenant.vocabulario.atendimento))}
          valor={String(atribuicao.count)}
          apoio={
            <span>
              de {atribuicao.mensagensNaJanela}{' '}
              {atribuicao.mensagensNaJanela === 1 ? 'mensagem enviada' : 'mensagens enviadas'} no período
            </span>
          }
        />
      </div>

      {bloqueado ? (
        <BloqueioPlano
          className="mt-4"
          precisaDo="essencial"
          acao="mandar a mesma mensagem para todas de uma vez"
          {...(totalClientes && totalClientes > 0
            ? { evidencia: { quantidade: totalClientes, substantivo: totalClientes === 1 ? 'cliente na sua base' : 'clientes na sua base' } }
            : {})}
          alternativa={<Link href="/admin/recuperar">Avisar uma de cada vez, de graça</Link>}
        />
      ) : (
        <Link href="/admin/campanhas/nova" className="mt-4 block">
          <Button largura="cheia">
            <Megaphone aria-hidden className="size-4" />
            Nova campanha
          </Button>
        </Link>
      )}

      <section className="mt-7">
        <SectionHeader icone={<TrendingUp className="size-3.5" />}>Resultados</SectionHeader>

        {lista.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icone={<Megaphone aria-hidden className="size-6" />}
              titulo="Nenhuma campanha ainda"
              descricao="Escolha um grupo de clientes, mande a mesma mensagem para todos e veja quantos voltaram."
              /*
                A saída muda com o plano, e continua existindo — `estado-vazio-tem-saida` exige uma
                e está certa. O que não pode é a saída levar ao formulário que a rota vai recusar:
                no Grátis, o caminho útil é avisar uma a uma, que funciona hoje e é de graça.
              */
              acao={
                bloqueado ? (
                  <Link href="/admin/recuperar">Avisar uma de cada vez</Link>
                ) : (
                  <Link href="/admin/campanhas/nova">Criar a primeira</Link>
                )
              }
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {lista.map((c) => {
              const resultado = porCampanha.get(c.id)
              return (
                <li key={c.id}>
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-corpo font-semibold">{c.name}</p>
                      <p className="tabular shrink-0 text-corpo font-semibold text-txt-2">
                        {c.sent_count} {c.sent_count === 1 ? 'mensagem' : 'mensagens'}
                      </p>
                    </div>

                    {/*
                      Migration 0054: `resultado` vem de `receitaPorCampanha`, que casa mensagem
                      DESTA campanha com agendamento concluído — o dado de verdade, não mais a
                      ausência de linha que a versão anterior mostrava (nunca "R$ 0,00" quando o
                      certo é "ninguém voltou ainda", que são coisas diferentes).
                    */}
                    {resultado && resultado.bookedCount > 0 ? (
                      <p className="mt-2 text-secundario text-txt-2">
                        {resultado.bookedCount} {resultado.bookedCount === 1 ? 'pessoa voltou' : 'pessoas voltaram'} ·{' '}
                        <span className="tabular font-semibold text-acc-2">{dinheiro.format(resultado.revenueCents / 100)}</span>
                      </p>
                    ) : (
                      <p className="mt-2 text-secundario text-txt-3">Ninguém voltou por aqui ainda.</p>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
