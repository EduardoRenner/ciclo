import Card from '@/components/ui/card'
import { MINIMO_PARA_AFIRMAR, TOLERANCIA_DIAS, type PrestacaoDeContas } from '@/core/cycle/prestacao-de-contas'

/**
 * `docs/48` C5 — a prova, não a promessa.
 *
 * `docs/45` §1.4 mediu que nenhum dos seis concorrentes mostra ao dono o quanto a própria previsão
 * acertou. Todos prometem prever; nenhum se mede contra o que prometeu. É a única coisa daquela
 * grade que um concorrente não pode ter amanhã mesmo, porque exige histórico — e é por isso que
 * ela mora AQUI, embaixo da lista que a previsão produziu, e não numa tela de relatório: o lugar
 * onde a pessoa decide se acredita no número é o lugar onde ela usa o número.
 */
export default function PrestacaoDeContasDoMotor({ contas }: { contas: PrestacaoDeContas }) {
  if (contas.conferidas === 0 && contas.emAberto === 0) return null

  const percentual = contas.acertoBps === null ? null : Math.round(contas.acertoBps / 100)

  return (
    <Card className="mb-5 flex flex-col gap-1">
      <p className="text-corpo">
        {percentual === null ? (
          <>
            O Motor ainda está aprendendo com este salão:{' '}
            <strong className="tabular">
              {contas.conferidas} {contas.conferidas === 1 ? 'previsão conferida' : 'previsões conferidas'}
            </strong>{' '}
            até agora. A taxa de acerto só é afirmada a partir de {MINIMO_PARA_AFIRMAR}.
          </>
        ) : (
          <>
            O Motor acertou <strong className="tabular text-acc-2">{percentual}%</strong> das{' '}
            <strong className="tabular">{contas.conferidas}</strong> previsões já conferidas.
          </>
        )}
      </p>

      <p className="text-secundario text-txt-2">
        Acerto é a pessoa ter voltado até {TOLERANCIA_DIAS} dias da data prevista. Quem passou de um mês sem voltar conta como erro. Senão
        a nota subiria justamente quando o Motor errasse mais.
      </p>

      {/*
        A direção do erro é o que dá para AGIR: se as pessoas voltam sistematicamente depois, a
        lista está chamando cedo demais e o dono gasta mensagem à toa.
      */}
      {contas.erroMedianoDias !== null && contas.erroMedianoDias !== 0 ? (
        <p className="text-secundario text-txt-2">
          Quem volta costuma aparecer{' '}
          <strong>
            {Math.abs(contas.erroMedianoDias)} {Math.abs(contas.erroMedianoDias) === 1 ? 'dia' : 'dias'}{' '}
            {contas.erroMedianoDias > 0 ? 'depois' : 'antes'}
          </strong>{' '}
          do que o Motor previu.
        </p>
      ) : null}

      {contas.emAberto > 0 ? (
        <p className="text-label text-txt-3">
          {contas.emAberto} {contas.emAberto === 1 ? 'previsão ainda pode' : 'previsões ainda podem'} se confirmar; não entram na conta.
        </p>
      ) : null}
    </Card>
  )
}
