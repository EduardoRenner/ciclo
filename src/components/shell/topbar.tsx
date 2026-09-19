'use client'

import { CalendarClock, ChevronLeft, Megaphone, Menu, Package, Scissors, Settings, Users, Wallet } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import Sheet from '@/components/ui/sheet'

import { paiDaRota } from './navegacao'
import wordmark from '../../../public/marca/ciclo-wordmark-aqua.png'
import wordmarkClaro from '../../../public/marca/ciclo-wordmark-aqua-claro.png'

/**
 * Atalhos do menu de funcionalidades (docs/61 §4, pedido do Eduardo em 2026-09-13 de comparar
 * com apps do setor tipo Booksy/Belezinha). Curadoria, não a lista inteira de `/admin/config`:
 * a barra inferior já cobre Hoje/Agenda/Recuperar/Clientes/Marcar, então aqui entra só o que fica
 * de fora dela e é usado com frequência — o resto (fidelidade, notificações, segurança...)
 * continua em "Configurações", o último item da lista.
 */
const ATALHOS = [
  { href: '/admin/caixa', titulo: 'Caixa', icone: Wallet },
  { href: '/admin/config/servicos', titulo: 'Serviços', icone: Scissors },
  { href: '/admin/config/profissionais', titulo: 'Time', icone: Users },
  { href: '/admin/campanhas', titulo: 'Campanhas', icone: Megaphone },
  { href: '/admin/estoque', titulo: 'Estoque', icone: Package },
  { href: '/admin/series', titulo: 'Recorrência', icone: CalendarClock },
  { href: '/admin/config', titulo: 'Configurações', icone: Settings },
] as const

/**
 * Barra do topo. Deixou de ser um enfeite de marca e virou **navegação**: na
 * raiz de cada aba mostra a marca e o menu de atalhos (`ATALHOS`, com
 * Configurações como último item — não existe mais ícone de engrenagem à
 * parte); em qualquer sub-rota vira o caminho de volta, com o nome do
 * destino — que num PWA `standalone`, sem barra de navegador, é a diferença
 * entre poder sair da tela e não poder.
 *
 * `pt-[env(safe-area-inset-top)]`: com `viewportFit: "cover"` e a barra de
 * status translúcida do iOS (os dois declarados em `app/layout.tsx`), sem esta
 * folga o conteúdo da barra fica **por baixo** do relógio e da ilha dinâmica.
 *
 * Continua sem buscar dado nenhum de propósito — não pode virar fetch novo em
 * toda tela do app.
 */
export default function Topbar() {
  const pathname = usePathname()
  const pai = paiDaRota(pathname)
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <header
      className={
        'sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/75 px-[var(--gutter)] ' +
        'pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150'
      }
    >
      {pai ? (
        <Link
          href={pai.href}
          className="-ml-2 flex h-12 items-center gap-0.5 rounded-[var(--radius-sm)] pl-1 pr-3 text-corpo font-semibold text-acc-2 transition active:scale-[.97]"
        >
          <ChevronLeft aria-hidden className="size-5" />
          {pai.rotulo}
        </Link>
      ) : (
        <>
          <div className="flex h-12 items-center">
            {/* Lockup completo (redesenho aqua, 2026-08-26) — nunca mais o nome
                digitado à parte do símbolo; onde "Ciclo" aparece fora de frase,
                é a marca de verdade.

                Dois arquivos: o "iclo" do wordmark padrão é quase branco e some no
                tema claro. O CSS (`globals.css`, `.marca-no-escuro`/`.marca-no-claro`)
                mostra um por vez conforme o `data-theme` do wrapper.

                `sizes="70px"`: mesmo conserto de `selo.tsx` — sem isso o `next/image`
                pedia o balde de 3840px do `deviceSizes` pra mostrar ~69px (h-7 × a
                proporção 2,46:1 do arquivo fonte). Medido na aba de rede em toda tela
                `/admin/*` (esta barra aparece em todas), agora bate com o mesmo `h-7`
                que `page.tsx` (landing) já tinha corrigido. */}
            <Image src={wordmark} alt="CICLO" sizes="70px" className="marca-no-escuro h-7 w-auto" />
            <Image src={wordmarkClaro} alt="" aria-hidden sizes="70px" className="marca-no-claro h-7 w-auto" />
          </div>

          {/*
            Menu de 3 linhas (docs/61 §4): a navegação PRINCIPAL continua sendo a barra inferior —
            isto é só o atalho pro que fica de fora dela. Substitui a engrenagem que ficava sozinha
            aqui, competindo com peso de navegação primária por um ícone que só levava a uma tela:
            agora abre a lista, e "Configurações" é o último item dela, não um ícone à parte.

            À direita, não à esquerda: é o lado que o polegar alcança sem trocar a pega do
            aparelho — pedido do Eduardo em 2026-09-13, depois de a primeira versão ter ido pra
            esquerda (a marca centralizada valia menos que o alcance de verdade).
          */}
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Menu"
            className="ml-auto grid size-12 shrink-0 place-items-center rounded-[var(--radius-pill)] text-txt-2 transition hover:bg-surface-2 active:scale-[.94]"
          >
            <Menu aria-hidden className="size-5" />
          </button>
        </>
      )}

      <Sheet aberto={menuAberto} aoFechar={setMenuAberto} titulo="Menu">
        <nav className="flex flex-col gap-1 pb-2">
          {ATALHOS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              onClick={() => setMenuAberto(false)}
              className="flex h-12 items-center gap-3 rounded-[var(--radius-sm)] px-2 text-corpo font-semibold text-txt transition hover:bg-surface-2 active:scale-[.98]"
            >
              <a.icone aria-hidden className="size-5 text-txt-3" />
              {a.titulo}
            </Link>
          ))}
        </nav>
      </Sheet>
    </header>
  )
}
