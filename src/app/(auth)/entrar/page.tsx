import { ChevronRight, Scissors, CalendarHeart } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import Card from '@/components/ui/card'
import { portaDeEntrada } from '@/core/auth/porta-de-entrada'
import { BUSCA_ABERTA } from '@/core/busca/negocios'
import { loginPorNumeroDisponivel } from '@/server/auth/login-por-numero'
import { provedoresSociaisParaRequisicao } from '@/server/auth/provedores-sociais'
import { sessaoAtual } from '@/server/auth/session'

import LoginSocial from '../login-social'
import JeitosDeEntrar from './jeitos-de-entrar'

export const metadata = { title: "Entrar" }

type Busca = { porta?: string; erro?: string; proximo?: string }

const linkVoltar = 'mx-auto flex h-12 items-center px-3 text-secundario font-semibold text-acc-2'

export default async function PaginaEntrar({ searchParams }: { searchParams: Promise<Busca> }) {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/admin/hoje')

  const porta = portaDeEntrada(await searchParams)

  /*
    docs/114 L-02: é a primeira tela do app da loja (o middleware manda a `/` para cá) e de quem abre o
    site sem sessão. Um app para os dois públicos começa perguntando quem é.
  */
  if (porta === 'escolher') {
    return (
      <TelaPublica>
        <Selo />
        <h1 className="text-center font-display text-titulo font-semibold">Como você usa o CICLO?</h1>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Link href="/entrar?porta=profissional" className="block">
            <Card pressionavel className="flex min-h-16 items-center gap-3">
              <Scissors aria-hidden className="size-6 shrink-0 text-acc-2" />
              <span className="min-w-0 flex-1">
                <span className="block text-corpo font-bold">Sou profissional</span>
                <span className="mt-0.5 block text-secundario text-txt-2">Entrar ou criar a conta do meu negócio</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-txt-3" />
            </Card>
          </Link>
          <Link href="/entrar?porta=cliente" className="block">
            <Card pressionavel className="flex min-h-16 items-center gap-3">
              <CalendarHeart aria-hidden className="size-6 shrink-0 text-acc-2" />
              <span className="min-w-0 flex-1">
                <span className="block text-corpo font-bold">Sou cliente</span>
                <span className="mt-0.5 block text-secundario text-txt-2">Marcar um horário</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-txt-3" />
            </Card>
          </Link>
        </div>
      </TelaPublica>
    )
  }

  /*
    A área da cliente (docs/110 L4) ainda não existe, e o formulário de entrar cria conta de NEGÓCIO
    para número novo. Então a porta da cliente explica como se marca hoje, sem conta.
  */
  if (porta === 'cliente') {
    return (
      <TelaPublica>
        <Selo />
        <div className="flex max-w-sm flex-col gap-3 text-center">
          <h1 className="font-display text-titulo font-semibold">Para marcar um horário</h1>
          <p className="text-corpo text-txt-2">
            Abra o link que quem te atende mandou. Lá você escolhe o serviço, o dia e o horário e põe seu nome e número.
            Não precisa criar conta.
          </p>
          <p className="text-corpo text-txt-2">Não tem o link? Peça pelo WhatsApp de quem te atende.</p>
          <p className="text-secundario text-txt-3">Para remarcar ou cancelar, fale com quem te atende.</p>
        </div>
        {/* docs/114 L-06: quem não tem o link procura por serviço e cidade. */}
        {BUSCA_ABERTA ? (
          <Link
            href="/buscar"
            className="flex h-12 w-full max-w-sm items-center justify-center rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc shadow-elevado"
          >
            Procurar quem atende perto de você
          </Link>
        ) : null}
        <Link href="/entrar" className={linkVoltar}>
          Voltar
        </Link>
      </TelaPublica>
    )
  }

  const provedores = await provedoresSociaisParaRequisicao((await headers()).get('user-agent'))

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        {/* O `Selo` (lockup completo) já diz "Ciclo" — repetir aqui era a mesma
            palavra duas vezes seguidas. As outras telas de `TelaPublica` têm
            título próprio (a pergunta é o que muda de tela pra tela); esta
            ganha o dela. */}
        <h1 className="font-display text-titulo font-semibold">Que bom te ver de novo</h1>
        <p className="mt-1 text-secundario text-txt-2">Entre para ver o resumo do seu dia.</p>
      </div>
      <LoginSocial provedores={provedores} />
      <JeitosDeEntrar numeroDisponivel={loginPorNumeroDisponivel()} />
      <Link href="/entrar?porta=cliente" className={linkVoltar}>
        Sou cliente
      </Link>
    </TelaPublica>
  )
}
