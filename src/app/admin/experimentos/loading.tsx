import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'
import { EsqueletoCabecalho } from '@/components/ui/esqueleto-tela'

/** Mesma forma da tela pronta: o formulário e dois testes. */
export default function CarregandoTestes() {
  return (
    <div aria-busy="true">
      <EsqueletoCabecalho />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
            <Skeleton className="mt-2 h-3 w-48" />
          </Card>
        ))}
      </div>
    </div>
  )
}
