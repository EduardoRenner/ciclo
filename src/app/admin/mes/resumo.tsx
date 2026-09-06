import Link from 'next/link'

import StatTile from '@/components/ui/stat-tile'
import { SEM_AMOSTRA, percentualOuTraco } from '@/core/text/sem-amostra'
import { MINIMO_DE_MESES } from '@/core/caixa/serie-mensal'

import type { ConcentracaoDoMes } from '@/server/services/caixa'
import type { PrestacaoDeContas } from '@/core/cycle/prestacao-de-contas'
import type { SerieMensal } from '@/core/caixa/serie-mensal'

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * "2026-03-01" vira "março". O ano só entra quando não é o corrente, para a frase não pesar.
 *
 * `anoCorrente` chega de fora, e não de `new Date()`, porque "o ano de agora" depende do fuso do
 * salão: das 21h à meia-noite em Brasília o ano UTC já virou. A guarda `dia-do-salao-nao-e-utc`
 * pegou exatamente isso na primeira versão desta função.
 */
function mesPorExtenso(iso: string, anoCorrente: number): string {
  const [ano, mes] = iso.split('-').map(Number)
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(Date.UTC(ano!, mes! - 1, 1))
  return ano === anoCorrente ? nome : `${nome} de ${ano}`
}

/**
 * Os cinco números da tese, nesta ordem, cada um levando à tela onde ele vira ação — `docs/50`
 * L-07, critério 2. A ordem não é decorativa: ela conta a frase que o produto existe para dizer.
 * *Entrou tanto, sobrou tanto, o tanto que sobrou depende dessa pessoa, tem tanto parado em quem
 * sumiu, e o Motor acertou tanto do que prometeu.*
 *
 * Nenhum número é calculado aqui. Quando falta dado, a regra é a mesma do resto da casa: dizer o
 * que falta e levar até lá — nunca preencher com zero, que se lê como resultado.
 */
export default function ResumoDoMes({
  mes,
  entrouCents,
  sobrouCents,
  comandas,
  concentracao,
  paradoCents,
  clientesParados,
  motor,
  servicosSemMaterial,
  custoFixoRespondido,
  serie,
}: {
  mes: string
  entrouCents: number
  sobrouCents: number
  comandas: number
  /** `null` para quem não alcança `report:team` — `docs/50` L-10. */
  concentracao: ConcentracaoDoMes | null
  paradoCents: number
  clientesParados: number
  motor: PrestacaoDeContas
  servicosSemMaterial: number
  /** O dono já respondeu as três perguntas do aluguel? (`0072`) */
  custoFixoRespondido: boolean
  /** `docs/50` L-09 — os meses já congelados, e a variação do lucro por atendimento. */
  serie: SerieMensal
}) {
  const maior = concentracao?.maior ?? null
  const nomeDoMaior = concentracao && maior?.professionalId ? concentracao.nomes[maior.professionalId] : null

  if (comandas === 0) {
    return (
      <p className="text-corpo text-txt-2">
        Nenhuma comanda fechada este mês ainda. Assim que a primeira fechar, os cinco números
        aparecem aqui.{' '}
        <Link href="/admin/agenda" className="font-semibold text-acc-2">
          Ver a agenda
        </Link>
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Link href="/admin/caixa" className="block">
        <StatTile
          heroi
          pressionavel
          rotulo="Entrou"
          valor={dinheiro.format(entrouCents / 100)}
          apoio={`${comandas} ${comandas === 1 ? 'comanda fechada' : 'comandas fechadas'}`}
        />
      </Link>

      <Link href="/admin/caixa" className="block">
        <StatTile
          pressionavel
          rotulo="Sobrou"
          valor={dinheiro.format(sobrouCents / 100)}
          apoio={[
            'depois do produto, da maquininha, da comissão',
            custoFixoRespondido ? ' e do aluguel' : '',
            servicosSemMaterial > 0
              ? ` — ainda sem o custo de ${servicosSemMaterial} ${servicosSemMaterial === 1 ? 'serviço' : 'serviços'}`
              : '',
            !custoFixoRespondido && servicosSemMaterial === 0 ? ' — o aluguel ainda não entra' : '',
          ].join('')}
        />
      </Link>

      {/*
        `vaiADizerAlgo` é falso quando o salão tem um profissional só: 100% do lucro vem do dono, e
        isso não é dependência de ninguém. Mostrar "100% do seu lucro vem de você" seria o número
        certo respondendo a pergunta errada.
      */}
      <Link href="/admin/caixa" className="block">
        <StatTile
          pressionavel
          rotulo="De quem depende"
          valor={concentracao?.vaiADizerAlgo && maior ? percentualOuTraco(maior.participacaoBps) : SEM_AMOSTRA}
          apoio={
            concentracao === null
              ? 'só o dono e quem cuida do financeiro veem esta linha'
              : concentracao.vaiADizerAlgo && nomeDoMaior
                ? `do lucro do mês veio de ${nomeDoMaior}`
                : 'ainda não há equipe suficiente para essa conta dizer algo'
          }
        />
      </Link>

      <Link href="/admin/recuperar" className="block">
        <StatTile
          pressionavel
          rotulo="Parado em quem sumiu"
          valor={dinheiro.format(paradoCents / 100)}
          apoio={
            clientesParados === 0
              ? 'ninguém em atraso hoje'
              : `de lucro, em ${clientesParados} ${clientesParados === 1 ? 'pessoa que passou do tempo' : 'pessoas que passaram do tempo'}`
          }
        />
      </Link>

      {/*
        `acertoBps` é `null` enquanto não há amostra, e `null` não é zero — dizer "o Motor acertou
        0%" de um salão que ainda não teve previsão conferida seria acusar o produto de um erro que
        ele não cometeu.
      */}
      {/*
        A série, e ela é o único número desta tela que não existe em outra: o `docs/46` escolheu
        como defesa o que acumula com o TEMPO DE USO do salão, e não com escala. Um concorrente não
        tem como copiar o março deste salão.

        A frase compara o lucro POR ATENDIMENTO, não o do mês: um mês com mais dias úteis mexe no
        total sem dizer nada sobre a saúde do negócio.
      */}
      {serie.variacaoBps !== null ? (
        <p className="text-secundario text-txt-2">
          O que sobra de cada atendimento{' '}
          <strong className={serie.variacaoBps >= 0 ? 'text-acc-2' : 'text-bad'}>
            {serie.variacaoBps >= 0 ? 'subiu' : 'caiu'} {Math.abs(Math.round(serie.variacaoBps / 100))}%
          </strong>{' '}
          desde {mesPorExtenso(serie.primeiroMesComparado!, Number(mes.split('-')[0]))}.
        </p>
      ) : serie.pontos.length > 0 ? (
        <p className="text-secundario text-txt-3">
          {serie.pontos.length === 1 ? '1 mês fechado' : `${serie.pontos.length} meses fechados`} guardados. A partir de{' '}
          {MINIMO_DE_MESES} dá para dizer se o que sobra de cada atendimento está subindo.
        </p>
      ) : null}

      <Link href="/admin/recuperar" className="block">
        <StatTile
          pressionavel
          rotulo="O Motor acertou"
          valor={percentualOuTraco(motor.acertoBps)}
          apoio={
            motor.acertoBps === null
              ? `ainda sem previsão conferida${motor.emAberto > 0 ? ` — ${motor.emAberto} em aberto` : ''}`
              : `de ${motor.conferidas} ${motor.conferidas === 1 ? 'previsão conferida' : 'previsões conferidas'}`
          }
        />
      </Link>
    </div>
  )
}
