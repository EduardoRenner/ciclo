import Link from 'next/link'
import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { sessaoAtual } from '@/server/auth/session'

/**
 * TICKET-025: "Hoje" é a rota inicial. Quem já tem sessão nem vê esta
 * página — só passa por aqui no instante do redirect.
 */
export default async function Home() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/admin/hoje')

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        <h1 className="text-numero font-extrabold">CICLO</h1>
        <p className="mt-2 max-w-[30ch] text-corpo text-txt-2">
          A agenda que sabe quando cada cliente volta — e traz de volta quem sumiu.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/entrar"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[image:var(--grad-acc)] px-5 text-corpo font-semibold text-on-acc shadow-elevado transition duration-[var(--dur-1)] hover:brightness-110 active:scale-[.97]"
        >
          Entrar
        </Link>
        <Link
          href="/cadastro"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.97]"
        >
          Criar conta
        </Link>
      </div>
    </TelaPublica>
  )
}
