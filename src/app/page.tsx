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
        <h1 className="text-titulo font-extrabold">CICLO</h1>
        <p className="mt-1 text-secundario text-txt-2">Entre para ver o resumo do seu dia.</p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/entrar"
          className="rounded-[var(--radius-sm)] bg-[linear-gradient(135deg,var(--acc),var(--acc-2))] px-5 py-3 text-corpo font-semibold text-[#0a0a0f] transition active:scale-[.98]"
        >
          Entrar
        </Link>
        <Link
          href="/cadastro"
          className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 py-3 text-corpo font-semibold text-txt transition active:scale-[.98]"
        >
          Criar conta
        </Link>
      </div>
    </TelaPublica>
  )
}
