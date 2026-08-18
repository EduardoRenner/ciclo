import { redirect } from 'next/navigation'

import { sessaoAtual } from '@/server/auth/session'

/**
 * TICKET-025: "Hoje" é a rota inicial. Quem já tem sessão nem vê esta
 * página — só passa por aqui no instante do redirect. Sem `/entrar` como
 * tela ainda (só os endpoints do TICKET-009), quem não tem sessão fica no
 * placeholder em vez de cair num link morto.
 */
export default async function Home() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/hoje')

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-[18px] text-center">
      <h1 className="text-2xl font-extrabold">CICLO</h1>
      <p className="text-muted-foreground text-sm">Entre para ver o resumo do seu dia.</p>
    </main>
  )
}
