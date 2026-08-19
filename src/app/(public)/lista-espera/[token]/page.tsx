import ReivindicarEncaixe from './reivindicar'

/**
 * Espelha `(public)/confirmar/[token]/` — o link que sai por WhatsApp
 * (TICKET-034) não tinha página nenhuma até agora. `force-dynamic` por
 * segurança: sem `generateStaticParams`, um segmento dinâmico ainda é
 * candidato a cache estático, e o nonce do CSP por requisição não bate com
 * o do build (ver `docs/DECISOES.md`).
 */
export const dynamic = 'force-dynamic'

export default async function PaginaListaEspera({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-[18px] py-8 text-center">
      <ReivindicarEncaixe token={token} />
    </main>
  )
}
