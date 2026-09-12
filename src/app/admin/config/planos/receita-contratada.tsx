import Card from '@/components/ui/card'
import { dinheiro } from '@/lib/formato'

/**
 * CICLO Clube · C-06 — quanto o clube já garante esse mês, separado da receita avulsa que depende
 * de agenda cheia. `0` aparece igual (não some): é informação, "ainda não tenho ninguém assinando"
 * é diferente de a seção não existir.
 */
export default function ReceitaContratada({ cents }: { cents: number }) {
  return (
    <Card className="mt-3 border-acc-2/40 bg-acc-soft">
      <p className="text-label font-semibold text-txt-2">Receita contratada este mês</p>
      <p className="mt-1 text-titulo font-bold text-acc-2">{dinheiro.format(cents / 100)}</p>
      <p className="mt-1 text-secundario text-txt-3">Soma das assinaturas ativas do clube, sem depender da agenda encher.</p>
    </Card>
  )
}
