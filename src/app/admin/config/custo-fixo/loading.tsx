import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'
import { EsqueletoCabecalho } from '@/components/ui/esqueleto-tela'

/** Mesma forma da tela pronta: cabeçalho e um cartão com três campos. */
export default function CarregandoCustoFixo() {
  return (
    <div aria-busy="true">
      <EsqueletoCabecalho />
      <Card>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-full" />
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
        <Skeleton className="mt-4 h-12 w-full" />
      </Card>
    </div>
  )
}
