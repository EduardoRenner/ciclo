import Orcamento from './orcamento'

export default async function PaginaOrcamento({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-[18px] py-8 text-center">
      <Orcamento token={token} />
    </main>
  )
}
