import { ArrowRight, Calculator, Info, Play, Tag, UserPlus } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import Card from '@/components/ui/card'
import { linksDaBio, type LinkDaBio } from '@/core/aquisicao/links-da-bio'
import { slugDeDemonstracaoNoAr } from '@/server/services/demonstracao'

import wordmark from '../../../../public/marca/ciclo-wordmark-aqua.png'
import wordmarkClaro from '../../../../public/marca/ciclo-wordmark-aqua-claro.png'

import type { Metadata } from 'next'

/**
 * A página que o link da bio do Instagram aponta (`docs/82` rodada 35): a "linktree" no domínio do
 * produto. Fica aqui, e não num serviço de terceiros, para o middleware gravar a origem `instagram`
 * (`?origem=instagram`, primeiro toque) e para a marca e o tema serem os do produto.
 *
 * Conteúdo estático (`ROTAS_DE_CONTEUDO_ESTATICO`): HTML igual para todo visitante, sem sessão. A única
 * leitura de banco é a mesma da home (qual página de demonstração está no ar), por isso o `revalidate`.
 *
 * Tema claro fixo, como o resto da frente pública: ver `tema-alcanca-o-body.test.ts`.
 */
export const revalidate = 600

export const metadata = {
  title: 'Retenção de clientes para quem tem agenda',
  description: 'Mostra quem parou de voltar, pelo nome, e deixa o texto pronto pra chamar de volta. Faça a conta do que você deixou de faturar.',
  alternates: { canonical: '/links' },
  openGraph: {
    title: 'CICLO · Retenção de clientes',
    description: 'Quanto você deixou de faturar com quem parou de voltar? A conta sai em um minuto.',
    type: 'website',
    locale: 'pt_BR',
  },
} satisfies Metadata

const ICONE: Record<LinkDaBio['chave'], typeof Calculator> = {
  calculadora: Calculator,
  cadastro: UserPlus,
  exemplo: Play,
  'como-funciona': Info,
  precos: Tag,
}

export default async function PaginaDeLinks() {
  const links = linksDaBio({ slugDeDemonstracao: await slugDeDemonstracaoNoAr() })

  return (
    <div data-theme="light" style={{ '--tabbar-h': '0px', '--sidebar-w': '0px', color: 'var(--txt)', background: 'var(--bg)' } as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#faf8f5}' }} />
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-[var(--gutter)] pb-10">
        <header className="flex flex-col items-center gap-4 pb-6 pt-10 text-center">
          <Image src={wordmark} alt="CICLO" sizes="96px" priority className="marca-no-escuro h-10 w-auto" />
          <Image src={wordmarkClaro} alt="" aria-hidden sizes="96px" priority className="marca-no-claro h-10 w-auto" />
          <h1 className="text-numero font-bold">Seu sistema de retenção de clientes</h1>
          <p className="max-w-[36ch] text-corpo text-txt-2">
            Mostra quem parou de voltar, pelo nome, e deixa o texto pronto pra chamar de volta.
          </p>
        </header>

        <ul className="flex flex-col gap-3">
          {links.map((l) => {
            const Icone = ICONE[l.chave]
            return (
              <li key={l.chave}>
                <Link href={l.href} className="block">
                  <Card
                    pressionavel
                    className={
                      l.destaque
                        ? 'flex items-start gap-3 border-acc-2/40 bg-acc-soft p-5'
                        : 'flex min-h-12 items-center gap-3'
                    }
                  >
                    <Icone aria-hidden className={l.destaque ? 'mt-0.5 size-6 shrink-0 text-acc-2' : 'size-5 shrink-0 text-txt-3'} />
                    <span className="min-w-0 flex-1">
                      <span className={l.destaque ? 'block text-numero font-bold' : 'block text-corpo font-semibold'}>{l.titulo}</span>
                      <span className="mt-0.5 block text-secundario text-txt-2">{l.descricao}</span>
                      {l.destaque ? (
                        <span className="mt-3 inline-flex items-center gap-1 text-corpo font-semibold text-acc-2">
                          Fazer a conta
                          <ArrowRight aria-hidden className="size-4" />
                        </span>
                      ) : null}
                    </span>
                    {l.destaque ? null : <ArrowRight aria-hidden className="size-4 shrink-0 text-txt-3" />}
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>

        <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-10 text-center text-label text-txt-3">
          <Link href="/entrar" className="toque-48 -mx-2 px-2 font-semibold text-txt-2 underline underline-offset-2">
            Já tenho conta
          </Link>
          <span aria-hidden>·</span>
          <Link href="/termos" className="toque-48 -mx-2 px-2 font-semibold text-txt-2 underline underline-offset-2">
            Termos
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacidade" className="toque-48 -mx-2 px-2 font-semibold text-txt-2 underline underline-offset-2">
            Privacidade
          </Link>
        </footer>
      </main>
    </div>
  )
}
