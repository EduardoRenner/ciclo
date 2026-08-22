import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'
import { EsqueletoCabecalho } from '@/components/ui/esqueleto-tela'

/** Mesma forma da tela pronta: cabeçalho, barra de dias, herói, "sobrou" e a linha de três. */
export default function CarregandoCaixa() {
  return (
    <div aria-busy="true">
      <EsqueletoCabecalho />

      <div className="mb-5 flex items-center gap-2">
        <Skeleton className="size-12 shrink-0" />
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="size-12 shrink-0" />
      </div>

      <Card className="mb-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-9 w-40" />
      </Card>

      <Card className="mb-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-6 w-32" />
      </Card>

      {/* Três colunas, como a linha material/taxa/comissão da tela pronta. */}
      <div className="mb-6 grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <Skeleton className="h-3 w-12" />
            <Skeleton className="mt-2 h-6 w-16" />
          </Card>
        ))}
      </div>
    </div>
  )
}
