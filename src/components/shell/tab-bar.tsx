'use client'

import { CalendarDays, Home, Plus, Users } from 'lucide-react'
import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import IconeAnel from '@/components/ui/icone-anel'
import { cn } from '@/lib/utils'

import { ABAS, HREF_DO_CENTRO, hrefDaAbaAtiva, type Aba } from './tabs'

const ICONES: Record<Aba['icone'], typeof Home | typeof IconeAnel> = { Home, CalendarDays, Users, Plus, Anel: IconeAnel }

type Props = {
  /** Rota do botão central. Parametrizado para o teste não depender de string solta. */
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
export default function TabBar({ hrefFab = HREF_DO_CENTRO }: Props) {
  const pathname = usePathname()
  const ativo = hrefDaAbaAtiva(pathname)
  const [esquerda, direita] = [ABAS.slice(0, 2), ABAS.slice(2)]

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl backdrop-saturate-150',
        'h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]',
        /*
         * No monitor a barra vira coluna à esquerda. Não é enfeite: no celular ela custa 64px
         * de uma tela de 812 (aceitável, o polegar precisa alcançar), mas num monitor de 900px
         * de altura os mesmos 64px são gastos sem nenhum ganho — e a navegação horizontal, com
         * 882px vazios dos dois lados, denunciava um app de celular esticado no meio da tela.
         */
        'lg:inset-y-0 lg:right-auto lg:h-auto lg:w-[var(--sidebar-w)] lg:border-r lg:border-t-0 lg:pb-0',
      )}
    >
      <div
        className={cn(
          'mx-auto flex h-[var(--tabbar-h)] w-full max-w-[560px] items-stretch justify-around',
          'lg:h-full lg:flex-col lg:items-stretch lg:justify-start lg:gap-1 lg:px-3 lg:pt-6',
        )}
      >
        {esquerda.map((aba) => (
          <ItemAba key={aba.href} aba={aba} ativa={ativo === aba.href} />
        ))}

        <div className="flex flex-1 items-center justify-center lg:order-first lg:flex-none lg:pb-4">
          {/*
            O botão central sobe para fora da barra: com 64px de altura ele não cabe mais dentro
            sem espremer os rótulos, e a peça mais importante da tela passa a flutuar sobre o
            conteúdo em vez de dividir espaço com quatro ícones.

            31/08: essa "peça mais importante" deixou de ser marcar horário e passou a ser o Motor
            de Ciclo — o porquê está em `tabs.ts`, junto de `HREF_DO_CENTRO`. Resumo: o centro é o
            único ponto que o polegar alcança sem reposicionar a mão, e estava com a ação mais
            comum em vez da mais valiosa.
          */}
          <Link
            href={hrefFab}
            aria-label="Recuperar receita"
            aria-current={pathname.startsWith(HREF_DO_CENTRO) ? 'page' : undefined}
            className={cn(
              'grid size-14 -translate-y-4 place-items-center rounded-[var(--radius-pill)]',
              'border-4 border-surface bg-acc text-on-acc shadow-fab',
              // Na coluna lateral não há barra para "subir de dentro": vira um botão largo no topo.
              'lg:h-12 lg:w-full lg:translate-y-0 lg:justify-start lg:gap-2 lg:border-0 lg:px-3 lg:flex lg:items-center',
              'transition duration-[var(--dur-1)] ease-[var(--ease-ios)] hover:brightness-110 active:scale-[.92]',
            )}
          >
            <IconeDoFab />
            {/*
              Na coluna lateral o botão tem 207px de largura e trazia só o "+"
              encostado na esquerda — medido. Os quatro destinos logo abaixo
              mostram ícone + rótulo, então a ação mais importante do produto
              era a única peça anônima da navegação, e o `gap-2` ao lado existia
              para um rótulo que nunca foi escrito. No celular o FAB continua
              redondo e só com o ícone: lá o `aria-label` basta e texto não cabe.
            */}
            <span className="hidden text-corpo font-semibold lg:inline">Recuperar receita</span>
          </Link>
        </div>

        {direita.map((aba) => (
          <ItemAba key={aba.href} aba={aba} ativa={ativo === aba.href} />
        ))}
      </div>
    </nav>
  )
}

/** Piso de visibilidade do giro — ver o porquê no comentário de `IconeDoFab` abaixo. */
const GIRO_MINIMO_MS = 500

/**
 * `useLinkStatus` só funciona dentro de um filho do `<Link>` (lê contexto que
 * o próprio Link fornece) — por isso é um componente à parte, não uma
 * variável no meio do FAB. `pending` fica `true` do clique até a rota de
 * destino terminar de carregar.
 *
 * **Revisado em 2026-09-21, a pedido do Eduardo.** A versão anterior ligava `animate-spin`
 * direto no `pending` cru — "gira de verdade enquanto espera, não por um tempo fixo torcido para
 * parecer certo". Na prática isso fazia o giro sumir: o `<Link>` para `/admin/recuperar` já está
 * prefetchado (fica sempre visível na barra), então a navegação resolve com o payload já em cache
 * — `pending` vira `true` e `false` rápido demais para o olho notar, e a marca só parecia girar no
 * SEGUNDO clique (quando algo já tinha invalidado o cache do prefetch e a navegação de fato
 * esperou rede). O ícone é a marca do produto no momento de maior intenção (a pessoa foi atrás do
 * Motor de Ciclo) — ele precisa girar de forma confiável, não só quando a rede está lenta o
 * bastante para dar tempo. Aqui o giro nunca é mais CURTO que `pending`: se a navegação demorar de
 * verdade, ele continua até `pending` resolver — só o mínimo de visibilidade é garantido, não um
 * teto.
 */
function IconeDoFab() {
  const { pending } = useLinkStatus()
  const [girando, setGirando] = useState(false)

  useEffect(() => {
    if (pending) {
      setGirando(true)
      return
    }
    const tempo = setTimeout(() => setGirando(false), GIRO_MINIMO_MS)
    return () => clearTimeout(tempo)
  }, [pending])

  return <IconeAnel aria-hidden className={cn('size-7 lg:size-5', girando && 'animate-spin')} />
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
        // Na coluna, ícone e rótulo ficam lado a lado e a linha inteira é o alvo.
        'lg:h-12 lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:rounded-[var(--radius-sm)] lg:px-3 lg:pt-0 lg:hover:bg-surface-2',
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
          'lg:h-8 lg:w-8',
          ativa && 'bg-acc-soft',
        )}
      >
        <Icone aria-hidden className="size-5" />
      </span>
      <span className={cn('text-label', ativa ? 'font-bold' : 'font-semibold')}>{aba.rotulo}</span>
    </Link>
  )
}
