'use client'

import { useRouter } from 'next/navigation'

/**
 * Campo de data nativo — o seletor do próprio sistema é melhor que qualquer
 * calendário desenhado aqui, e já vem acessível e traduzido. Existe para fechar
 * o mês: sem ele, chegar a um dia de três semanas atrás custaria vinte toques
 * na seta.
 */
export default function SeletorDeDia({ dia, hoje }: { dia: string; hoje: string }) {
  const router = useRouter()

  return (
    <label className="flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3.5">
      <span className="shrink-0 text-label font-semibold text-txt-2">Ir para</span>
      <input
        type="date"
        value={dia}
        max={hoje}
        onChange={(e) => e.target.value && router.push(`/admin/caixa?dia=${e.target.value}`)}
        /*
         * Sem `outline-none`: o anel global de `:focus-visible` (globals.css §7, "foco visível em
         * todo elemento interativo") é o ÚNICO indicador que este campo tem — a borda visível é do
         * `<label>` em volta, e não reage ao foco do input. Removê-lo deixava quem navega por
         * teclado sem nenhum sinal de onde está, no mesmo componente cujo comentário acima elogia
         * o campo nativo por "já vir acessível". Mesmo padrão de `components/ui/input.tsx`, que
         * mantém o anel global e só acrescenta cor de borda.
         */
        className="tabular w-full bg-transparent text-corpo text-txt"
        aria-label="Escolher o dia do caixa"
      />
    </label>
  )
}
