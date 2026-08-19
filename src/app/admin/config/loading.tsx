import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'

export default function CarregandoConfig() {
  return (
    <>
      <header className="pb-5 pt-6">
        <Skeleton className="h-7 w-44" />
      </header>

      <div className="flex flex-col gap-6" aria-busy="true">
        {[0, 1].map((grupo) => (
          <div key={grupo}>
            <Skeleton className="mb-3 h-3 w-28" />
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="flex items-center gap-3">
                  <Skeleton className="size-10 shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="mt-2 h-3 w-2/3" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
