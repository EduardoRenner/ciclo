import Link from 'next/link'

import { ChevronRight } from 'lucide-react'

import Card from '@/components/ui/card'
import { MINIMO_PARA_AFIRMAR, type PrestacaoDeContas } from '@/core/cycle/prestacao-de-contas'

/**
 * `docs/45` §1.4 (Blue Ocean, quadrante CRIAR) mediu que a prestação de contas do Motor — a única
 * coisa que nenhum dos seis concorrentes pesquisados faz — nasceu e ficou invisível: só mora em
 * `/admin/recuperar` e no resumo de `/admin/mes`, telas que o dono abre por escolha. `docs/48`
 * já tinha marcado isso como a fraqueza do próprio recurso ("Dono ENXERGA sem explicação? Não").
 *
 * Este teaser NÃO duplica a explicação completa (`recuperar/prestacao.tsx` já faz isso, e o
 * comentário de lá é explícito: o lugar de explicar é o lugar onde a pessoa usa o número). Aqui é
 * só a manchete — uma linha, um link — na tela que o dono abre todo dia sem precisar decidir abrir.
 */
export default function PrestacaoTeaser({ contas }: { contas: PrestacaoDeContas }) {
  // Mesma trava do card completo: sem histórico suficiente, não afirma nada — silêncio, não card
  // vazio nem "calculando...". `docs/64`/`CLAUDE.md`: nunca promete o que o dado ainda não sustenta.
  if (contas.conferidas < MINIMO_PARA_AFIRMAR || contas.acertoBps === null) return null

  const percentual = Math.round(contas.acertoBps / 100)

  return (
    <Link href="/admin/recuperar" className="block active:scale-[.99]">
      <Card pressionavel className="mb-5 flex items-center justify-between gap-3">
        <p className="text-corpo">
          O Motor acertou <strong className="tabular text-acc-2">{percentual}%</strong> dos retornos previstos
        </p>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-txt-3" />
      </Card>
    </Link>
  )
}
