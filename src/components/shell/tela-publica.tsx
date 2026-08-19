/**
 * Shell das telas sem sessão (`/`, `/entrar`, `/cadastro`, `/onboarding`) — antes
 * disto cada uma era só texto centralizado num fundo preto sólido, sem
 * nenhuma identidade visual nem sinal de movimento. Tinha um brilho radial
 * atrás do conteúdo; removido (era a mesma assinatura de landing gerada do
 * herói público e do admin — `docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §B3).
 * A entrada em fade+slide (`tw-animate-css`) continua: é sinal de movimento
 * sem depender de cor.
 */
export default function TelaPublica({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden px-[18px] py-10">
      <div className="flex w-full animate-in flex-col items-center gap-6 fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </div>
    </main>
  )
}
