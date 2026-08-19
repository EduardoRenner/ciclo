import Link from 'next/link'
import { redirect } from 'next/navigation'

import { sessaoAtual } from '@/server/auth/session'

/**
 * TICKET-025: "Hoje" é a rota inicial. Quem já tem sessão nem vê esta
 * página — só passa por aqui no instante do redirect.
 */
export default async function Home() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/hoje')

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-[18px] text-center">
      <div>
        <h1 className="text-2xl font-extrabold">CICLO</h1>
        <p className="text-muted-foreground text-sm">Entre para ver o resumo do seu dia.</p>
      </div>
      <div className="flex gap-3">
        <Link href="/entrar" className="rounded-[var(--radius-sm)] bg-[linear-gradient(135deg,var(--acc),var(--acc-2))] px-5 py-3 font-semibold text-[#0a0a0f]">
          Entrar
        </Link>
        <Link href="/cadastro" className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 py-3 font-semibold text-txt">
          Criar conta
        </Link>
      </div>
    </main>
  )
}
