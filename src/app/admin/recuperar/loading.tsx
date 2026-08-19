import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'

export default function CarregandoRecuperar() {
  return (
    <>
      <header className="pb-5 pt-6">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-2 h-4 w-64" />
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3" aria-busy="true">
        {[0, 1].map((i) => (
          <Card key={i}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-24" />
          </Card>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-[var(--radius-pill)]" />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </Card>
        ))}
      </div>
    </>
  )
}
