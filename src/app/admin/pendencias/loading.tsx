import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'

export default function CarregandoPendencias() {
  return (
    <>
      <header className="pb-5 pt-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-52" />
      </header>

      <div className="flex flex-col gap-2" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-3 w-2/5" />
          </Card>
        ))}
      </div>
    </>
  )
}
