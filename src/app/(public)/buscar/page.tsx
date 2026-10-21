import { ChevronRight, MapPin, Search } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import Card from '@/components/ui/card'
import { BUSCA_ABERTA } from '@/core/busca/negocios'
import { dinheiro } from '@/lib/formato'
import { buscarNegocios } from '@/server/services/busca-publica'

import type { Metadata } from 'next'

export const metadata = {
  title: 'Procurar quem atende',
  description: 'Ache quem faz unha, cílios, sobrancelha e cabelo perto de você e marque pelo link.',
  alternates: { canonical: '/buscar' },
} satisfies Metadata

/** Os atalhos da busca: as áreas que o CICLO atende primeiro (docs/108). */
const ATALHOS = ['Unhas', 'Cílios', 'Sobrancelha', 'Cabelo', 'Depilação', 'Estética']

/**
 * docs/114 L-06: a cliente procura por serviço e cidade/bairro e abre a página de quem atende para
 * marcar. Formulário GET de verdade (sem JavaScript também funciona) e resultado lido no servidor.
 * Só aparece quem pode receber agendamento pelo link e não desligou "Aparecer na busca".
 */
export default async function PaginaBuscar({ searchParams }: { searchParams: Promise<{ q?: string; cidade?: string }> }) {
  if (!BUSCA_ABERTA) notFound()
  const { q = '', cidade = '' } = await searchParams
  const buscou = q.trim() !== '' || cidade.trim() !== ''
  const resultados = buscou ? await buscarNegocios({ termo: q, cidade }) : []

  return (
    <div data-theme="light" style={{ '--tabbar-h': '0px', '--sidebar-w': '0px', color: 'var(--txt)', background: 'var(--bg)' } as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#faf8f5}' }} />
      <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-[var(--gutter)] pb-12 pt-8">
        <h1 className="font-display text-titulo font-semibold">Procurar quem atende</h1>
        <p className="mt-1 text-corpo text-txt-2">Escolha o serviço e a cidade, abra a página e marque pelo link.</p>

        <form method="get" action="/buscar" className="mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Serviço</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Unhas, cílios, sobrancelha…"
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Cidade ou bairro</span>
            <input
              name="cidade"
              defaultValue={cidade}
              autoComplete="address-level2"
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
          <button
            type="submit"
            className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc shadow-elevado transition active:scale-[.98]"
          >
            <Search aria-hidden className="size-5" />
            Procurar
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {ATALHOS.map((a) => (
            <Link
              key={a}
              href={`/buscar?q=${encodeURIComponent(a)}${cidade ? `&cidade=${encodeURIComponent(cidade)}` : ''}`}
              className="flex h-12 items-center rounded-[var(--radius-pill)] border border-line-2 bg-surface-2 px-4 text-secundario font-semibold text-txt-2"
            >
              {a}
            </Link>
          ))}
        </div>

        <section aria-live="polite" className="mt-6 flex flex-col gap-3">
          {buscou && resultados.length === 0 ? (
            <p className="text-corpo text-txt-2">
              Ninguém por aqui ainda com essa busca. Tente outra palavra ou só a cidade, ou peça o link para quem já te atende.
            </p>
          ) : null}
          {resultados.map((r) => (
            <Link key={r.slug} href={`/${r.slug}`} className="block">
              <Card pressionavel className="flex items-center gap-3">
                {r.logoUrl ? (
                  <Image src={r.logoUrl} alt="" width={48} height={48} className="size-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-acc-soft text-corpo font-bold text-acc-2">
                    {r.nome.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-corpo font-bold">{r.nome}</span>
                  <span className="mt-0.5 block text-secundario text-txt-2">
                    {r.servico} · a partir de {dinheiro.format(r.aPartirDeCents / 100)}
                  </span>
                  {r.endereco ? (
                    <span className="mt-0.5 flex items-center gap-1 truncate text-label text-txt-3">
                      <MapPin aria-hidden className="size-3.5 shrink-0" />
                      <span className="truncate">{r.endereco}</span>
                    </span>
                  ) : null}
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-txt-3" />
              </Card>
            </Link>
          ))}
        </section>
      </main>
    </div>
  )
}
