import { ReceiptText } from 'lucide-react'
import Link from 'next/link'

import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'

/**
 * APR-113: comanda que não existe (apagada, de outro negócio, ou id digitado errado) responde 404
 * com esta tela, em vez de cair no erro genérico de "não consegui carregar", que dizia para tentar
 * de novo algo que nunca vai carregar.
 */
export default function ComandaNaoEncontrada() {
  return (
    <>
      <PageHeader titulo="Comanda" />
      <Card className="p-0">
        <EmptyState
          icone={<ReceiptText aria-hidden className="size-6" />}
          titulo="Essa comanda não existe"
          descricao="Ela pode ter sido apagada, ou o endereço está errado."
          acao={<Link href="/admin/hoje">Voltar para Hoje</Link>}
        />
      </Card>
    </>
  )
}
