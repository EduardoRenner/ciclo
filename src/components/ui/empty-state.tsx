import { cn } from '@/lib/utils'

type Props = React.ComponentPropsWithoutRef<'div'> & {
  icone: React.ReactNode
  titulo: string
  descricao: string
  /**
   * Obrigatório: §4 diz que estado vazio nunca é só "nenhum resultado". Tela
   * vazia sem saída é beco sem saída.
   */
  acao: React.ReactNode
}

export default function EmptyState({ className, icone, titulo, descricao, acao, ...props }: Props) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)} {...props}>
      <div
        aria-hidden
        className="mb-4 flex size-14 items-center justify-center rounded-[var(--radius)] bg-acc-soft text-acc-2"
      >
        {icone}
      </div>
      <p className="text-corpo font-semibold text-txt">{titulo}</p>
      <p className="mt-1 max-w-[34ch] text-secundario text-txt-2">{descricao}</p>
      <div className="mt-5">{acao}</div>
    </div>
  )
}
