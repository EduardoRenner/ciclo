/**
 * Shell das telas sem sessão (`/`, `/entrar`, `/cadastro`, `/onboarding`) — antes
 * disto cada uma era só texto centralizado num fundo preto sólido, sem
 * nenhuma identidade visual nem sinal de movimento. O gradiente radial usa só
 * os tokens que já existem (`--acc-soft`), sem imagem nem custo de rede; a
 * entrada em fade+slide (`tw-animate-css`, já instalado, usado até aqui só no
 * toast) tira a sensação de tela estática/travada.
 */
export default function TelaPublica({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden px-[18px] py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(60% 45% at 50% 0%, var(--acc-soft), transparent 70%)' }}
      />
      <div className="flex w-full animate-in flex-col items-center gap-6 fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </div>
    </main>
  )
}
