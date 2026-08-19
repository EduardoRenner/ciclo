import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'

/** A ficha é a tela mais pesada do app (histórico, fidelidade, notas, pacotes) — é a que mais precisava de esqueleto e a que não tinha. */
export default function CarregandoFicha() {
  return (
    <div aria-busy="true">
      <header className="flex items-center gap-3 py-5">
        <Skeleton className="size-16 rounded-[var(--radius-pill)]" />
        <div className="flex-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <Card key={i}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-24" />
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </Card>
        ))}
      </div>
    </div>
  )
}
