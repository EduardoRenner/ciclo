'use client'

import FilterRow from '@/components/ui/filter-row'
import { paraData } from '@/core/agenda/dias'

/**
 * APR-109 (docs/98 I-10): o trilho de 14 dias do agendar público, extraído para o "Marcar" do painel
 * usar o mesmo (APR-110). O selecionado é sólido; o dia fechado continua no trilho e continua
 * tocável (a agenda de um profissional pode fugir do expediente padrão), só com a marca "fechado"
 * no rótulo que o leitor de tela ouve.
 */

export default function TrilhoDeDias({
  dias,
  dia,
  fechados,
  aoEscolher,
}: {
  dias: readonly string[]
  dia: string
  fechados: ReadonlySet<string>
  aoEscolher: (dia: string) => void
}) {
  return (
    <FilterRow rotulo="Escolher o dia">
      {dias.map((d) => {
        const data = paraData(d)
        const fechado = fechados.has(d)
        const nomeDoDia = data.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })
        return (
          <button
            key={d}
            type="button"
            onClick={() => aoEscolher(d)}
            aria-current={d === dia ? 'date' : undefined}
            aria-label={`${nomeDoDia}, dia ${data.getUTCDate()}${fechado ? ', fechado' : ''}`}
            className={
              'flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] text-label font-semibold transition duration-[var(--dur-1)] ease-[var(--ease-ios)] active:scale-[.95] ' +
              (d === dia ? 'bg-acc text-on-acc shadow-elevado' : fechado ? 'bg-surface-2/50 text-txt-3 hover:bg-surface-3' : 'bg-surface-2 text-txt-2 hover:bg-surface-3 hover:text-txt')
            }
          >
            <span className="uppercase">{data.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')}</span>
            {/* APR-118 (A-24): dia fechado é riscado E diz "fechado", em todos os 14 dias, com uma regra só. */}
            <span className={`tabular text-corpo font-bold ${d === dia ? '' : fechado ? 'text-txt-3 line-through' : 'text-txt'}`}>{data.getUTCDate()}</span>
            {fechado ? <span className="text-overline lowercase text-txt-3">fechado</span> : null}
          </button>
        )
      })}
    </FilterRow>
  )
}
