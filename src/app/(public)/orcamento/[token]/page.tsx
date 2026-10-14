import ErroPublico from '@/components/ui/erro-publico'
import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { orcamentoPublico } from '@/server/services/orcamentos'

import Orcamento from './orcamento'

export const dynamic = 'force-dynamic'
export const metadata = { title: "Orçamento", robots: { index: false, follow: false } }

/**
 * APR-119 (docs/98 F-08, A-10): o orçamento é lido no servidor pelo token — itens e total já vêm no
 * HTML. Link inválido ou orçamento apagado abre no erro com uma saída, em vez de "Carregando…" seguido
 * de um erro sem botão.
 */
export default async function PaginaOrcamento({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const dados = await withNovoTenant((svc) => orcamentoPublico(svc, token)).catch((erro: unknown) => {
    if (erro instanceof AppError && erro.code === 'NOT_FOUND') return null
    throw erro
  })

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center px-[18px] pt-12 pb-8 text-center">
      {dados ? (
        <Orcamento token={token} inicial={dados} />
      ) : (
        <ErroPublico
          titulo="Esse link não vale mais"
          mensagem="O link do orçamento tem prazo, ou ele foi refeito. Peça um novo a quem te mandou."
          saida={{ href: '/', rotulo: 'Ir para o início' }}
        />
      )}
    </main>
  )
}
