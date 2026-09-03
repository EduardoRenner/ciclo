import Link from 'next/link'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'

/**
 * Sem este arquivo, o Next gera um `/_not-found` estático — e o nonce do CSP
 * (por requisição, `src/middleware.ts`) nunca bate com o carimbado no HTML do
 * build, bloqueando todo script. Achado ao vivo em produção (a rota real
 * quebrada era `/dev/ui`, que devolve 404 de propósito fora de desenvolvimento
 * — a página que quebrava era esta). `force-dynamic` resolve.
 */
export const dynamic = 'force-dynamic'

/**
 * O `<title>` desta página era só "CICLO", herdado do `default` do layout raiz — medido no
 * navegador em 2026-09-03.
 *
 * É o mesmo defeito que `titulos-de-tela` existe para pegar, e o motivo está no docstring daquela
 * guarda: no App Router a navegação é no cliente, e o `<title>` é o que o leitor de tela anuncia
 * quando a rota troca. Com "CICLO" em todas, quem não enxerga clica num link quebrado e não
 * recebe sinal nenhum de que não chegou onde queria (WCAG 2.4.2).
 *
 * A guarda não alcançava este arquivo: ela varre `admin`, `(auth)`, `onboarding` e `(public)`
 * procurando `page.tsx`. Esta é a tela que TODO link quebrado do produto entrega, incluindo os que
 * circulam no WhatsApp de cliente de salão.
 *
 * **O que este conserto alcança, medido — e o que não alcança.** O HTML do servidor sai com
 * `<title>Página não encontrada · CICLO</title>` e status 404 de verdade (conferido com `curl`,
 * não deduzido). Já o `document.title` **volta para "CICLO" depois da hidratação**: o resolvedor
 * de metadados do cliente não considera o `not-found`. Resolve para quem chega pela URL, que é o
 * caso real de link quebrado, e para buscador; não resolve para quem cai aqui navegando dentro do
 * app. Fica escrito porque metade de um conserto anunciada como inteira é o tipo de documentação
 * mentirosa que este projeto já teve que corrigir uma vez.
 */
export const metadata = { title: 'Página não encontrada' }

export default function NaoEncontrado() {
  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        <h1 className="text-titulo font-bold">Página não encontrada</h1>
        <p className="mt-1 text-secundario text-txt-2">O endereço não existe ou mudou de lugar.</p>
      </div>
      <Link
        href="/"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc shadow-elevado transition duration-[var(--dur-1)] hover:brightness-110 active:scale-[.97]"
      >
        Voltar ao início
      </Link>
    </TelaPublica>
  )
}
