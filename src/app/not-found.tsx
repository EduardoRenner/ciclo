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
        <h1 className="text-titulo font-extrabold">Página não encontrada</h1>
        <p className="mt-1 text-secundario text-txt-2">O endereço não existe ou mudou de lugar.</p>
      </div>
      <Link
        href="/"
        className="rounded-[var(--radius-sm)] bg-[linear-gradient(135deg,var(--acc),var(--acc-2))] px-5 py-3 text-corpo font-semibold text-[#0a0a0f] transition hover:brightness-110 active:scale-[.98]"
      >
        Voltar ao início
      </Link>
    </TelaPublica>
  )
}
