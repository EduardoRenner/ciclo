import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'

export default function CarregandoAgenda() {
  return (
    <>
      <header className="pb-5 pt-6">
        <Skeleton className="h-7 w-32" />
      </header>

      <div className="flex flex-col gap-2" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-14 shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
