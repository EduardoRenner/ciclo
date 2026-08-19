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
        className="mb-4 grid size-16 place-items-center rounded-[var(--radius)] bg-acc-soft text-acc-2"
      >
        {icone}
      </div>
      <p className="text-corpo font-semibold text-txt">{titulo}</p>
      <p className="mt-1 max-w-[34ch] text-secundario text-txt-2">{descricao}</p>

      {/*
        O slot de ação estiliza um `<a>` ou `<button>` cru que venha de fora.
        Quatro telas — as três mais usadas do app, mais campanhas — passavam
        `acao={<Link>…</Link>}` sem classe nenhuma: a chamada para a ação do
        estado vazio, que é a primeira coisa que uma conta nova vê, renderizava
        como texto corrido. Estilizar o slot faz o erro deixar de ser possível,
        em vez de só corrigir os quatro casos de hoje.
      */}
      <div
        className={cn(
          'mt-5',
          '[&_a]:inline-flex [&_a]:h-12 [&_a]:items-center [&_a]:justify-center [&_a]:gap-2',
          '[&_a]:rounded-[var(--radius-sm)] [&_a]:bg-[image:var(--grad-acc)] [&_a]:px-5',
          '[&_a]:text-corpo [&_a]:font-semibold [&_a]:text-on-acc [&_a]:shadow-elevado',
          '[&_a]:transition [&_a]:duration-[var(--dur-1)] [&_a]:active:scale-[.97]',
        )}
      >
        {acao}
      </div>
    </div>
  )
}
