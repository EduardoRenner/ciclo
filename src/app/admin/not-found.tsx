import { Compass } from 'lucide-react'
import Link from 'next/link'

import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'

/**
 * APR-113 (docs/98 A-04, A-18, F-24): endereço que não existe dentro do painel. Antes caía no 404
 * da raiz, sem a casca (barra, menu), como se a pessoa tivesse saído do app. Aqui a casca fica
 * (este arquivo mora dentro do layout de `/admin`) e a saída é a Hoje.
 */
export default function PaginaNaoEncontradaNoPainel() {
  return (
    <>
      <PageHeader titulo="Essa página não existe" />
      <Card className="p-0">
        <EmptyState
          icone={<Compass aria-hidden className="size-6" />}
          titulo="Essa página não existe"
          descricao="O endereço está errado ou essa tela mudou de lugar."
          acao={<Link href="/admin/hoje">Voltar para Hoje</Link>}
        />
      </Card>
    </>
  )
}
