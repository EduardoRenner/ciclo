import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import Link from 'next/link'

import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import SectionHeader from '@/components/ui/section-header'
import StatTile from '@/components/ui/stat-tile'
import { dinheiro } from '@/lib/formato'

import SeletorDeDia from './seletor-de-dia'

import type { ResumoCaixa } from '@/server/services/caixa'

type Props = {
  dia: string
  hoje: string
  diario: ResumoCaixa & { date: string }
  mensal: ResumoCaixa & { month: string }
  comissoes: { id: string; nome: string; totalCents: number }[]
  /** Soma dos atendimentos concluídos no dia — só para explicar o caixa zerado. */
  atendidoCents: number
}

/** A data já vem resolvida no fuso do salão pelo servidor; aqui é só aritmética de calendário. */
function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(ano!, mes! - 1, dia!))
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function porExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(ano!, mes! - 1, dia!)),
  )
}

function mesPorExtenso(mes: string): string {
  const [ano, m] = mes.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(ano!, m! - 1, 1)),
  )
}

export default function Caixa({ dia, hoje, diario, mensal, comissoes, atendidoCents }: Props) {
  const ontem = somarDias(dia, -1)
  const amanha = somarDias(dia, 1)
  const ehHoje = dia === hoje
  const comComissao = comissoes.filter((c) => c.totalCents > 0)

  const seta =
    'grid size-12 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 ' +
    'text-txt-2 transition duration-[var(--dur-1)] hover:bg-surface-3 hover:text-txt active:scale-[.94]'

  return (
    <>
      <PageHeader
        overline={ehHoje ? 'Hoje' : undefined}
        titulo="Caixa"
        descricao={porExtenso(dia)}
        acao={
          ehHoje ? null : (
            <Link
              href="/admin/caixa"
              className="flex h-12 items-center text-label font-semibold text-acc-2 transition active:scale-[.97]"
            >
              Voltar para hoje
            </Link>
          )
        }
      />

      <nav aria-label="Trocar de dia" className="mb-5 flex items-center gap-2">
        <Link href={`/admin/caixa?dia=${ontem}`} className={seta} aria-label="Dia anterior">
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <SeletorDeDia dia={dia} hoje={hoje} />
        </div>
        {/*
          Avançar além de hoje abriria um dia que ainda não aconteceu. Em vez de
          um link que devolve zero, a seta apaga — como `aria-disabled` num link
          não impede o clique, vira `span`.
        */}
        {ehHoje ? (
          <span className={`${seta} pointer-events-none opacity-40`} aria-hidden>
            <ChevronRight className="size-5" />
          </span>
        ) : (
          <Link href={`/admin/caixa?dia=${amanha}`} className={seta} aria-label="Próximo dia">
            <ChevronRight aria-hidden className="size-5" />
          </Link>
        )}
      </nav>

      {diario.ticketsCount === 0 ? (
        <Card className="mb-6 p-0">
          <EmptyState
            icone={<Receipt aria-hidden className="size-6" />}
            titulo="Nenhuma comanda fechada nesse dia"
            descricao={
              atendidoCents > 0
                ? `Você concluiu ${dinheiro.format(atendidoCents / 100)} em atendimentos, mas o caixa só conta o que passou pela comanda — é ela que sabe material e comissão.`
                : 'O caixa soma o que foi cobrado nas comandas. Feche a comanda do atendimento e o valor aparece aqui.'
            }
            acao={<Link href="/admin/agenda">Ver a agenda</Link>}
          />
        </Card>
      ) : (
        <>
          <StatTile
            className="mb-3"
            heroi
            rotulo="Entrou no dia"
            valor={dinheiro.format(diario.revenueCents / 100)}
            apoio={`${diario.ticketsCount} ${diario.ticketsCount === 1 ? 'comanda fechada' : 'comandas fechadas'}`}
          />

          <StatTile
            className="mb-3"
            rotulo="Sobrou"
            valor={dinheiro.format(diario.profitCents / 100)}
            apoio="O que entrou, menos a gorjeta do profissional, o material e a comissão."
          />

          {/*
            Havia um terceiro quadro aqui, "Taxa", que mostrava R$ 0,00 todo dia desde sempre:
            NADA no projeto escreve `tickets.fee_cents` — nem a comanda, nem o pagamento, nem job
            nenhum. Um quadro permanentemente zerado ao lado de Material e Comissão não é neutro:
            ele afirma que a taxa da maquininha está sendo descontada do "Sobrou", e o dono do
            salão fecha o mês achando que sobrou mais do que sobrou. `fee_cents` continua na
            tabela e no resumo da API, e `calcularSobraDaComanda` já a desconta — no dia em que
            existir quem preencha, o quadro volta. `tests/unit/design/caixa-nao-promete-taxa.test.ts`
            reprova se ele voltar antes disso.
          */}
          <div className="mb-6 grid grid-cols-2 gap-2">
            <StatTile rotulo="Material" valor={dinheiro.format(diario.materialCents / 100)} />
            <StatTile rotulo="Comissão" valor={dinheiro.format(diario.commissionCents / 100)} />
          </div>
        </>
      )}

      <section className="mb-6">
        <SectionHeader>{mesPorExtenso(mensal.month)}</SectionHeader>
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-corpo text-txt-2">Entrou no mês</span>
            <span className="tabular text-stat font-bold text-txt">{dinheiro.format(mensal.revenueCents / 100)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-corpo text-txt-2">Sobrou no mês</span>
            <span className="tabular text-corpo font-semibold text-acc-2">{dinheiro.format(mensal.profitCents / 100)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-corpo text-txt-2">Comandas</span>
            <span className="tabular text-corpo font-semibold text-txt">{mensal.ticketsCount}</span>
          </div>
        </Card>
      </section>

      {comComissao.length > 0 ? (
        <section className="mb-6">
          <SectionHeader>Comissão do mês por profissional</SectionHeader>
          <Card className="flex flex-col gap-3">
            {comComissao.map((c) => (
              <div key={c.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-corpo text-txt">{c.nome}</span>
                <span className="tabular shrink-0 text-corpo font-semibold text-txt">
                  {dinheiro.format(c.totalCents / 100)}
                </span>
              </div>
            ))}
            {/*
              §5.7: o percentual é congelado no fechamento da comanda. Mudar a
              comissão de alguém hoje nunca reescreve o que já fechou — sem esta
              frase, um valor "errado" aqui parece defeito de conta.
            */}
            <p className="border-t border-line pt-3 text-secundario text-txt-3">
              Vale o percentual que estava valendo quando cada comanda fechou.
            </p>
          </Card>
        </section>
      ) : null}
    </>
  )
}
