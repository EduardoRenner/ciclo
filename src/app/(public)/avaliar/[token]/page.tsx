import Avaliar from './avaliar'

/**
 * Espelha `(public)/confirmar/[token]/` e `(public)/lista-espera/[token]/` — mesmo padrão de
 * link assinado sem sessão. `force-dynamic`: sem `generateStaticParams`, um segmento dinâmico
 * ainda é candidato a pré-renderização estática, e o nonce do CSP por requisição não bate com o
 * do build (ver `docs/DECISOES.md`).
 */
export const dynamic = 'force-dynamic'

export default async function PaginaAvaliar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-[18px] py-8 text-center">
      <Avaliar token={token} />
    </main>
  )
}
