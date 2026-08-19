import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'

/** Sem isto, o Next não mostra nada entre o clique e o Server Component terminar de buscar — a tela ficava parada, lendo como travada. */
export default function CarregandoHoje() {
  return (
    <div aria-busy="true">
      <header className="py-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-2 h-7 w-48" />
      </header>

      <Card className="mb-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-9 w-32" />
      </Card>

      <Skeleton className="mb-3 h-3 w-28" />
      <Card>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </Card>
    </div>
  )
}
