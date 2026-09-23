import Image from 'next/image'
import Link from 'next/link'

import Calculadora from './calculadora'

import wordmark from '../../../../public/marca/ciclo-wordmark-aqua.png'
import wordmarkClaro from '../../../../public/marca/ciclo-wordmark-aqua-claro.png'

import type { Metadata } from 'next'

/**
 * `docs/82` §8 — a ferramenta grátis que abre conversa: vale sozinha, sem cadastro, e termina na
 * pergunta que só o produto responde ("e quem você não lembra?").
 *
 * Três usos, e nenhum deles é "tráfego": o Eduardo abre no celular do dono durante a visita; o
 * representante/contador manda o link sem precisar "vender software"; e é o destino de todo post
 * (`?origem=conteudo`). Por isso ela é conteúdo estático (`ROTAS_DE_CONTEUDO_ESTATICO`): HTML igual
 * para todo visitante, nenhuma leitura de sessão, nenhuma entrada de credencial — a conta roda no
 * navegador e nada sai dele.
 */
export const revalidate = 3600

export const metadata = {
  title: 'Quanto você perde com cliente que parou de voltar',
  description:
    'Calculadora grátis para salão e barbearia: quanto deixou de entrar com os clientes que pararam de vir, pelo ritmo de retorno do seu negócio. Sem cadastro.',
  alternates: { canonical: '/calculadora' },
  openGraph: {
    title: 'Quanto você perde com cliente que parou de voltar · CICLO',
    description: 'Três números que você sabe de cabeça e a conta aparece. Grátis, sem cadastro.',
    type: 'website',
    locale: 'pt_BR',
  },
} satisfies Metadata

export default function PaginaCalculadora() {
  return (
    // Mesmo tema claro fixo de `/precos` — ver `tema-alcanca-o-body.test.ts`.
    <div data-theme="light" style={{ '--tabbar-h': '0px', '--sidebar-w': '0px', color: 'var(--txt)', background: 'var(--bg)' } as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#faf8f5}' }} />
      <main className="mx-auto min-h-dvh max-w-[720px] px-[var(--gutter)] pb-16">
        <header className="flex items-center justify-between gap-3 py-5">
          <Link href="/" className="toque-48 flex items-center">
            <Image src={wordmark} alt="CICLO" sizes="70px" className="marca-no-escuro h-7 w-auto" />
            <Image src={wordmarkClaro} alt="" aria-hidden sizes="70px" className="marca-no-claro h-7 w-auto" />
          </Link>
          <Link
            href="/entrar"
            className="flex h-12 items-center px-1 text-corpo font-semibold text-acc-2 transition active:scale-[.97]"
          >
            Entrar
          </Link>
        </header>

        <section className="py-8 sm:py-10">
          <h1 className="text-numero font-bold sm:text-[2.25rem] sm:leading-[1.1]">
            Quanto deixou de entrar com quem parou de voltar?
          </h1>
          <p className="mt-4 max-w-[52ch] text-corpo text-txt-2">
            Três números que você sabe de cabeça. Sem cadastro, sem porcentagem de pesquisa: a conta é com o ritmo
            do seu negócio, e aparece inteira embaixo do resultado.
          </p>
        </section>

        <Calculadora />
      </main>
    </div>
  )
}
