import { cn } from '@/lib/utils'

type Props = {
  titulo: string
  /** Linha miúda acima do título (data, contexto). */
  overline?: string
  descricao?: string
  /** Ação à direita — ícone quadrado de 48px ou link curto. */
  acao?: React.ReactNode
  className?: string
}

/**
 * O cabeçalho de tela estava reescrito em 12 arquivos, cada um com um `py`
 * diferente e uma ordem diferente de título/descrição/ação. Um só lugar agora
 * decide o ritmo vertical do topo de toda tela — é o que faz telas diferentes
 * parecerem o mesmo app.
 */
export default function PageHeader({ titulo, overline, descricao, acao, className }: Props) {
  return (
    <header className={cn('flex items-start justify-between gap-3 pb-5 pt-6', className)}>
      <div className="min-w-0 flex-1">
        {overline ? (
          <p className="text-overline font-semibold uppercase text-txt-3">{overline}</p>
        ) : null}
        <h1 className={cn('text-titulo font-bold text-txt', overline && 'mt-1')}>{titulo}</h1>
        {descricao ? <p className="mt-1.5 text-secundario text-txt-2">{descricao}</p> : null}
      </div>
      {acao ? <div className="shrink-0">{acao}</div> : null}
    </header>
  )
}
