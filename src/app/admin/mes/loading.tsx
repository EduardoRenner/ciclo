import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'
import { EsqueletoCabecalho } from '@/components/ui/esqueleto-tela'

/** Mesma forma da tela pronta: cabeçalho e os cinco quadros empilhados, o primeiro maior. */
export default function CarregandoOMes() {
  return (
    <div aria-busy="true">
      <EsqueletoCabecalho />

      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i}>
            <Skeleton className="h-3 w-28" />
            <Skeleton className={i === 0 ? 'mt-2 h-9 w-40' : 'mt-2 h-6 w-32'} />
            <Skeleton className="mt-2 h-3 w-48" />
          </Card>
        ))}
      </div>
    </div>
  )
}
