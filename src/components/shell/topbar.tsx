'use client'

import { ChevronLeft, Settings } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { paiDaRota } from './navegacao'
import wordmark from '../../../public/marca/ciclo-wordmark-aqua.png'
import wordmarkClaro from '../../../public/marca/ciclo-wordmark-aqua-claro.png'

/**
 * Barra do topo. Deixou de ser um enfeite de marca e virou **navegação**: na
 * raiz de cada aba mostra a marca e o atalho de configurações (o único caminho
 * para `/admin/config` que existe no app); em qualquer sub-rota vira o caminho
 * de volta, com o nome do destino — que num PWA `standalone`, sem barra de
 * navegador, é a diferença entre poder sair da tela e não poder.
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
        <div className="flex h-12 items-center">
          {/* Lockup completo (redesenho aqua, 2026-08-26) — nunca mais o nome
              digitado à parte do símbolo; onde "Ciclo" aparece fora de frase,
              é a marca de verdade.

              Dois arquivos: o "iclo" do wordmark padrão é quase branco e some no
              tema claro. O CSS (`globals.css`, `.marca-no-escuro`/`.marca-no-claro`)
              mostra um por vez conforme o `data-theme` do wrapper. */}
          <Image src={wordmark} alt="CICLO" className="marca-no-escuro h-7 w-auto" />
          <Image src={wordmarkClaro} alt="" aria-hidden className="marca-no-claro h-7 w-auto" />
        </div>
      )}

      {!pai ? (
        <Link
          href="/admin/config"
          aria-label="Configurações"
          className="ml-auto grid size-12 place-items-center rounded-[var(--radius-pill)] text-txt-3 transition hover:bg-surface-2 hover:text-txt-2 active:scale-[.94]"
        >
          <Settings aria-hidden className="size-5" />
        </Link>
      ) : null}
    </header>
  )
}
