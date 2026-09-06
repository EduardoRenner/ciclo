import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import Link from 'next/link'

import AlertBanner from '@/components/ui/alert-banner'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import SectionHeader from '@/components/ui/section-header'
import StatTile from '@/components/ui/stat-tile'
import { dinheiro } from '@/lib/formato'

import SeletorDeDia from './seletor-de-dia'

import type { ConcentracaoDoMes, ResumoCaixa } from '@/server/services/caixa'

type Props = {
  dia: string
  hoje: string
  diario: ResumoCaixa & { date: string }
  mensal: ResumoCaixa & { month: string }
  comissoes: { id: string; nome: string; totalCents: number }[]
  /** Soma dos atendimentos concluídos no dia — só para explicar o caixa zerado. */
  atendidoCents: number
  /** O dono já disse quanto a maquininha cobra? Ver `taxaEstaConfigurada` e `docs/49`. */
  taxaRespondida: boolean
  /** O dono já respondeu as três perguntas do aluguel? Ver `custoFixoEstaConfigurado` (`0072`). */
  custoFixoRespondido: boolean
  /**
   * Quantos serviços ativos ainda não têm material confiável — sem ficha, ou com produto da ficha
   * que nunca teve compra registrada (`medirMaterialDoCatalogo`).
   *
   * O quadro "Material" tem exatamente o problema que tirou o quadro "Taxa" desta tela em
   * 2026-08-28: R$ 0,00 ao lado de Comissão não se lê como "não implementado", se lê como "hoje
   * não teve". Até a 0069 o número vinha do custo que o pack semeou e parecia apurado; depois
   * dela ele passa a ser zero honesto — e zero sem rótulo é a mesma mentira, só que para baixo.
   */
  servicosSemMaterial: number
  /** De quem depende o que sobrou no mês (`docs/48` C7). */
  /**
   * `null` para quem não alcança `report:team` — `docs/50` L-10. Só o dono e quem cuida do
   * financeiro veem de quem o lucro depende, nome por nome; o `manager` costuma ser colega de quem
   * a frase nomeia.
   */
  concentracao: ConcentracaoDoMes | null
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

export default function Caixa({ dia, hoje, diario, mensal, comissoes, atendidoCents, taxaRespondida, custoFixoRespondido, servicosSemMaterial, concentracao }: Props) {
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
                ? `Você concluiu ${dinheiro.format(atendidoCents / 100)} em atendimentos, mas o caixa só conta o que passou pela comanda: é ela que sabe material e comissão.`
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
            apoio={[
              'O que entrou, menos a gorjeta do profissional, o material',
              servicosSemMaterial > 0 ? ' (ainda incompleto)' : '',
              taxaRespondida ? ', a taxa da maquininha' : '',
              ', a comissão',
              custoFixoRespondido ? ' e o aluguel.' : '. O aluguel ainda não entra.',
            ].join('')}
          />

          {/*
            O quadro "Taxa" saiu daqui em 2026-08-28 e volta agora, com a `0066`: mostrava R$ 0,00
            todo dia porque NADA no projeto escrevia `tickets.fee_cents`, e zero ao lado de
            Material e Comissão não se lê como "não implementado" — se lê como "hoje não teve
            taxa". A guarda `caixa-nao-promete-taxa` é de mão dupla e agora cobra o contrário:
            existe quem escreva, então a tela tem que mostrar.

            Mas só para quem respondeu. Um tenant que nunca abriu a tela de taxa tem `fee_cents`
            zero por falta de resposta, não por não pagar maquininha — e para ele o quadro seria a
            mesma mentira de antes. Esse caso ganha a faixa, que diz o que falta e leva até lá.
          */}
          <div className="mb-6 grid grid-cols-2 gap-2">
            <StatTile
              rotulo="Material"
              valor={dinheiro.format(diario.materialCents / 100)}
              apoio={
                servicosSemMaterial > 0
                  ? `falta o custo de ${servicosSemMaterial} ${servicosSemMaterial === 1 ? 'serviço' : 'serviços'}`
                  : undefined
              }
            />
            {taxaRespondida ? <StatTile rotulo="Taxa" valor={dinheiro.format(diario.feeCents / 100)} /> : null}
            <StatTile rotulo="Comissão" valor={dinheiro.format(diario.commissionCents / 100)} />
            {/*
              Mesma regra do quadro "Taxa": só aparece para quem respondeu. Quem nunca abriu a tela
              tem `fixed_cost_cents` zero por falta de resposta, e um R$ 0,00 ao lado dos outros se
              lê como "hoje não teve aluguel" — a frase que tirou o quadro "Taxa" daqui em 28/08.
            */}
            {custoFixoRespondido ? <StatTile rotulo="Aluguel" valor={dinheiro.format(diario.fixedCostCents / 100)} /> : null}
          </div>

          {taxaRespondida ? null : (
            <AlertBanner
              tom="warn"
              className="mb-6"
              acao={
                <Link href="/admin/config/taxas" className="text-acc-2">
                  Informar
                </Link>
              }
            >
              <p className="text-secundario">
                O <strong>Sobrou</strong> ainda não desconta a maquininha: você não disse quanto ela cobra.
              </p>
            </AlertBanner>
          )}
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

      {/*
        `docs/48` C7, e `docs/47` P07 é o motivo de ele existir: *"um barbeiro bom pede as contas —
        e leva metade da clientela junto"*. Nenhum sistema do setor mede isso; o dono descobre o
        tamanho da dependência no dia da demissão.

        Só aparece quando significa alguma coisa. Com um profissional só (o dono, quase sempre) a
        resposta é 100% e não é risco nenhum — ninguém sai de si mesmo —, e num mês no prejuízo
        "300% do prejuízo é do Rafa" não ajuda a decidir nada. Nos dois casos a seção some, em vez
        de mostrar um número que se lê como alerta e não é.
      */}
      {concentracao?.vaiADizerAlgo && concentracao.maior ? (
        <section className="mb-6">
          <SectionHeader>De quem depende o que sobra</SectionHeader>
          <Card className="flex flex-col gap-3">
            <p className="text-corpo">
              <strong className="tabular">{Math.round(concentracao.maior.participacaoBps / 100)}%</strong> do que sobrou em{' '}
              {mesPorExtenso(mensal.month)} veio de{' '}
              <strong>{concentracao.maior.professionalId ? (concentracao.nomes[concentracao.maior.professionalId] ?? 'profissional removido') : 'itens sem profissional'}</strong>.
            </p>

            <ul className="flex flex-col gap-2">
              {concentracao.fatias.map((fatia) => (
                <li key={fatia.professionalId ?? 'sem-profissional'} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-secundario text-txt-2">
                      {fatia.professionalId ? (concentracao.nomes[fatia.professionalId] ?? 'Profissional removido') : 'Sem profissional'}
                    </span>
                    <span className="tabular shrink-0 text-secundario font-semibold text-txt">
                      {Math.round(fatia.participacaoBps / 100)}% · {dinheiro.format(fatia.lucroCents / 100)}
                    </span>
                  </div>
                  {/* A barra é decoração do número que já está escrito ao lado — daí `aria-hidden`. */}
                  <div aria-hidden className="h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-surface-3">
                    <div className="h-full rounded-[var(--radius-pill)] bg-acc" style={{ width: `${Math.max(0, Math.min(100, fatia.participacaoBps / 100))}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

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
