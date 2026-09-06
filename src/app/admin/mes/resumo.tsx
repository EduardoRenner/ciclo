import Link from 'next/link'

import StatTile from '@/components/ui/stat-tile'
import { SEM_AMOSTRA, percentualOuTraco } from '@/core/text/sem-amostra'

import type { ConcentracaoDoMes } from '@/server/services/caixa'
import type { PrestacaoDeContas } from '@/core/cycle/prestacao-de-contas'

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

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
  entrouCents,
  sobrouCents,
  comandas,
  concentracao,
  paradoCents,
  clientesParados,
  motor,
  servicosSemMaterial,
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
          apoio={
            servicosSemMaterial > 0
              ? `depois do produto, da maquininha e da comissão — ainda sem o custo de ${servicosSemMaterial} ${servicosSemMaterial === 1 ? 'serviço' : 'serviços'}`
              : 'depois do produto, da maquininha e da comissão'
          }
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
