import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'
import { EsqueletoCabecalho } from '@/components/ui/esqueleto-tela'

/** Mesma forma da tela pronta: cabeçalho, o total do mês e algumas linhas de item. */
export default function CarregandoComissao() {
  return (
    <div aria-busy="true">
      <EsqueletoCabecalho />

      <Card>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-9 w-40" />
      </Card>

      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </Card>
        ))}
      </div>
    </div>
  )
}
