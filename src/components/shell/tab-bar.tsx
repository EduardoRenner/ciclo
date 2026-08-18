'use client'

import { CalendarDays, Home, Plus, Sparkles, Users } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

import { ABAS, abaAtiva, type Aba } from './tabs'

const ICONES: Record<Aba['icone'], typeof Home> = { Home, CalendarDays, Users, Sparkles }

type Props = {
  /** Rota do FAB — sempre "novo agendamento" no MVP; parametrizado para o teste não depender de string solta. */
  hrefFab?: string
}

/**
 * §3.3: 82px + safe-area, e §3.7: nada de menu hambúrguer — esta barra é a
 * navegação inteira do app do profissional. O FAB fica no terceiro slot dos
 * cinco (dois destinos de cada lado) para nascer visualmente centralizado, não
 * porque a ordem das ABAS tenha esse buraco.
 */
export default function TabBar({ hrefFab = '/agenda/novo' }: Props) {
  const pathname = usePathname()
  const [esquerda, direita] = [ABAS.slice(0, 2), ABAS.slice(2)]

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around',
        'border-t border-line bg-surface',
        'h-[calc(82px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]',
      )}
    >
      {esquerda.map((aba) => (
        <ItemAba key={aba.href} aba={aba} ativa={abaAtiva(pathname, aba.href)} />
      ))}

      <div className="flex flex-1 items-center justify-center">
        <Link
          href={hrefFab}
          aria-label="Novo agendamento"
          className={cn(
            'flex size-14 items-center justify-center rounded-full',
            'bg-[linear-gradient(135deg,var(--acc),var(--acc-2))] text-[#0a0a0f]',
            'shadow-lg transition active:scale-[.96]',
          )}
        >
          <Plus aria-hidden className="size-7" />
        </Link>
      </div>

      {direita.map((aba) => (
        <ItemAba key={aba.href} aba={aba} ativa={abaAtiva(pathname, aba.href)} />
      ))}
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
        'flex min-w-12 flex-1 flex-col items-center justify-center gap-1 pt-2',
        ativa ? 'text-acc-2' : 'text-txt-3',
      )}
    >
      <Icone aria-hidden className="size-6" />
      <span className="text-label font-semibold">{aba.rotulo}</span>
    </Link>
  )
}
