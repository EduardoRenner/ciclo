import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'
import type { Vazamento } from '@/core/caixa/mapa-de-vazamento'

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * docs/84 Aposta B — "onde estou perdendo dinheiro?", no topo do mês.
 *
 * Só R$ onde o dinheiro é medido; o resto é fato, sem número inventado (ver
 * `core/caixa/mapa-de-vazamento.ts`). Cada linha leva à tela onde se resolve. Lista vazia, a seção
 * inteira some — nenhum "está tudo certo" que ninguém pediu.
 */
export default function MapaDeVazamento({ linhas }: { linhas: Vazamento[] }) {
  if (linhas.length === 0) return null
  return (
    <section className="mb-6" aria-labelledby="titulo-vazamento">
      <SectionHeader>
        <span id="titulo-vazamento">Onde o dinheiro está escapando</span>
      </SectionHeader>
      <div className="grid gap-2">
        {linhas.map((l) => (
          <Link key={l.chave} href={l.href} className="block">
            <Card pressionavel className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-corpo font-semibold">{l.titulo}</p>
                {l.valorCents !== null ? <p className="tabular mt-0.5 text-stat font-bold text-txt">{dinheiro.format(l.valorCents / 100)}</p> : null}
                <p className="mt-0.5 text-secundario text-txt-2">{l.fato}</p>
                <p className="mt-1 text-label font-semibold text-acc-2">{l.acao}</p>
              </div>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-txt-3" />
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
