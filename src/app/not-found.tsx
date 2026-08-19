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
