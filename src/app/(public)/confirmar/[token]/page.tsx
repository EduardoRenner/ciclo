import ConfirmarAgendamento from './confirmar'

export default async function PaginaConfirmar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-[18px] py-8 text-center">
      <ConfirmarAgendamento token={token} />
    </main>
  )
}
