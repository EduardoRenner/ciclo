'use client'

import { CalendarDays, Home, Plus, Users } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import IconeAnel from '@/components/ui/icone-anel'
import { cn } from '@/lib/utils'

import { ABAS, abaAtiva, type Aba } from './tabs'

const ICONES: Record<Aba['icone'], typeof Home | typeof IconeAnel> = { Home, CalendarDays, Users, Anel: IconeAnel }

type Props = {
  /** Rota do FAB — sempre "novo agendamento" no MVP; parametrizado para o teste não depender de string solta. */
  hrefFab?: string
}

/**
 * §3.7: nada de menu hambúrguer — esta barra é a navegação inteira do app do
 * profissional. O FAB fica no terceiro slot dos cinco (dois destinos de cada
 * lado) para nascer visualmente centralizado, não porque a ordem das ABAS tenha
 * esse buraco.
 *
 * Altura: §3.3 pedia 82px, que somados ao relevo do iPhone davam ~116px — 14%
 * da tela gastos em navegação permanente, num app cuja tela principal é uma
 * lista. Passou para `--tabbar-h` (64px), a altura de uma barra de abas do iOS
 * com rótulo. O conteúdo interno é limitado a 560px como o resto do app: a
 * barra era `inset-x-0` puro e, em qualquer monitor, espalhava quatro ícones
 * por 1920px enquanto o app vivia numa coluna estreita no meio.
 */
export default function TabBar({ hrefFab = '/admin/agenda/novo' }: Props) {
  const pathname = usePathname()
  const [esquerda, direita] = [ABAS.slice(0, 2), ABAS.slice(2)]

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl backdrop-saturate-150',
        'h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <div className="mx-auto flex h-[var(--tabbar-h)] w-full max-w-[560px] items-stretch justify-around">
        {esquerda.map((aba) => (
          <ItemAba key={aba.href} aba={aba} ativa={abaAtiva(pathname, aba.href)} />
        ))}

        <div className="flex flex-1 items-center justify-center">
          {/*
            O FAB sobe para fora da barra: com 64px de altura ele não cabe mais
            dentro sem espremer os rótulos, e a peça mais importante da tela
            (marcar horário é o gesto que sustenta o produto) passa a flutuar
            sobre o conteúdo em vez de dividir espaço com quatro ícones.
          */}
          <Link
            href={hrefFab}
            aria-label="Novo agendamento"
            className={cn(
              'grid size-14 -translate-y-4 place-items-center rounded-[var(--radius-pill)]',
              'border-4 border-surface bg-acc text-on-acc shadow-fab',
              'transition duration-[var(--dur-1)] ease-[var(--ease-ios)] hover:brightness-110 active:scale-[.92]',
            )}
          >
            <Plus aria-hidden className="size-7" />
          </Link>
        </div>

        {direita.map((aba) => (
          <ItemAba key={aba.href} aba={aba} ativa={abaAtiva(pathname, aba.href)} />
        ))}
      </div>
    </nav>
  )
}

function ItemAba({ aba, ativa }: { aba: Aba; ativa: boolean }) {
  const Icone = ICONES[aba.icone]

  return (
    <Link
      href={aba.href}
      aria-current={ativa ? 'page' : undefined}
      className={cn(
        // min-w garante o alvo de 48px mesmo com a barra dividindo 5 espaços
        // largos: sem ele o toque encolhe em telas menores que o esperado.
        'flex min-w-12 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5',
        'transition duration-[var(--dur-1)] active:scale-[.94]',
        ativa ? 'text-acc-2' : 'text-txt-3 hover:text-txt-2',
      )}
    >
      {/*
        A cápsula de acento atrás do ícone é o que faz a aba ativa se ler de
        relance: antes a única diferença entre ativa e inativa era o tom do
        roxo contra o cinza — dois tons escuros, num aparelho no sol.
      */}
      <span
        className={cn(
          'grid h-7 w-12 place-items-center rounded-[var(--radius-pill)] transition-colors duration-[var(--dur-1)]',
          ativa && 'bg-acc-soft',
        )}
      >
        <Icone aria-hidden className="size-5" />
      </span>
      <span className={cn('text-label', ativa ? 'font-bold' : 'font-semibold')}>{aba.rotulo}</span>
    </Link>
  )
}
