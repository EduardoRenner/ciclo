import { Lock } from 'lucide-react'
import Link from 'next/link'

import { dinheiro } from '@/lib/formato'
import { cn } from '@/lib/utils'

import { NOME_DO_PLANO, precoDoPlanoPorMes, type PlanoTier } from '@/core/billing/planos'

/**
 * docs/18-MONETIZACAO-PLANO.md §M.1 — a peça de conversão mais importante do produto, mais que a
 * página de preço, porque aparece no momento em que a pessoa JÁ QUER FAZER alguma coisa.
 *
 * A regra 5.2 (decisão registrada em `09-PLATAFORMA.md` §13) exige motivo + caminho. O que
 * converte, além disso, é mostrar o valor concreto do outro lado COM O DADO DELA:
 *
 *   ❌ "Faça upgrade para enviar campanhas."
 *   ✅ "23 clientes seus estão atrasados, somando R$ 1.840. No Essencial você manda para todos
 *       de uma vez. Ou mande um a um agora, de graça."
 *
 * A segunda converte mais E é mais honesta, inclusive por oferecer o caminho gratuito — que no
 * desenho do plano grátis (§D.2) existe de verdade e funciona para sempre. Por isso `alternativa`
 * não é decorativa: quando existe um jeito de fazer sem pagar, ele aparece aqui.
 *
 * Nada nesta tela usa escassez, contador ou confirmshaming (§5.10). O texto do caminho gratuito
 * nunca é do tipo "não, prefiro perder dinheiro" — é a descrição neutra do que a pessoa vai fazer.
 */

type Props = {
  /** O degrau que libera o que ela tentou fazer. */
  precisaDo: PlanoTier
  /**
   * O que ela tentou fazer, na voz dela e por inteiro: "avisar todas de uma vez". A frase entra
   * em dois moldes diferentes ("Para {acao}, é preciso o X" e "No X você pode {acao}"), então
   * quem chama controla a redação — o componente não completa a frase por conta própria.
   */
  acao: string
  /**
   * O valor concreto do outro lado, com o dado DELA. Sem isto vira folheto — que é exatamente o
   * que o §M.1 diz que não converte. Opcional porque nem todo bloqueio tem número associado.
   */
  evidencia?: {
    quantidade: number
    substantivo: string
    /** Em centavos (regra 3 do CLAUDE.md). */
    valorCents?: number
  }
  /** O caminho gratuito, quando existe. "Mande um a um agora, de graça." */
  alternativa?: React.ReactNode
  className?: string
}

export default function BloqueioPlano({ precisaDo, acao, evidencia, alternativa, className }: Props) {
  const nome = NOME_DO_PLANO[precisaDo]

  return (
    <section
      className={cn('rounded-[var(--radius)] border border-line bg-surface p-5 shadow-elevado', className)}
      // `aria-label` em vez de `aria-labelledby`: o id era fixo, e duas instancias na mesma
      // pagina (acontece na vitrine, e vai acontecer numa tela com dois bloqueios) criavam id
      // duplicado — que e erro de acessibilidade e faz o leitor de tela anunciar o rotulo errado.
      aria-label={`Recurso do plano ${nome}`}
    >
      <div
        aria-hidden
        className="mb-3 flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-acc-soft text-acc-2"
      >
        <Lock className="size-5" />
      </div>

      {/*
        A evidência vem PRIMEIRO e em corpo grande: é o argumento. O nome do plano vem depois,
        como o meio de conseguir aquilo — e não como o assunto da tela.
      */}
      {evidencia ? (
        <p className="text-corpo font-semibold text-txt">
          <span className="tabular">{evidencia.quantidade}</span> {evidencia.substantivo}
          {evidencia.valorCents != null && evidencia.valorCents > 0 ? (
            <>
              , somando <span className="tabular">{dinheiro.format(evidencia.valorCents / 100)}</span>
            </>
          ) : null}
          .
        </p>
      ) : (
        <p className="text-corpo font-semibold text-txt">
          Para {acao}, é preciso o {nome}.
        </p>
      )}

      {evidencia ? (
        <p className="mt-1.5 text-secundario text-txt-2">
          No <span className="font-semibold text-txt">{nome}</span> você pode {acao}.
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        <Link
          href="/precos"
          className={
            'inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 ' +
            'text-corpo font-semibold text-on-acc shadow-elevado transition duration-[var(--dur-1)] ' +
            'hover:brightness-110 active:scale-[.97]'
          }
        >
          Ver o {nome} — {precoDoPlanoPorMes(precisaDo)}
        </Link>

        {/*
          O caminho gratuito fica embaixo, mas fica — e com alvo de 48px como qualquer outra ação.
          Escondê-lo ou encolhê-lo para empurrar a venda seria padrão escuro; o §D.2 desenhou o
          plano grátis justamente para que este caminho exista de verdade e funcione para sempre.
        */}
        {alternativa ? (
          <div className="[&_a]:flex [&_a]:h-12 [&_a]:w-full [&_a]:items-center [&_a]:justify-center [&_button]:flex [&_button]:h-12 [&_button]:w-full [&_button]:items-center [&_button]:justify-center [&_a]:text-corpo [&_button]:text-corpo [&_a]:font-semibold [&_button]:font-semibold [&_a]:text-txt-2 [&_button]:text-txt-2">
            {alternativa}
          </div>
        ) : null}
      </div>
    </section>
  )
}
