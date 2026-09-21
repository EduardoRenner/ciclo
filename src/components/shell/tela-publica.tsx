import ToastProvider from '@/components/ui/toast'

/**
 * Shell das telas sem sessão (`/`, `/entrar`, `/cadastro`, `/onboarding`) — antes
 * disto cada uma era só texto centralizado num fundo preto sólido, sem
 * nenhuma identidade visual nem sinal de movimento. Tinha um brilho radial
 * atrás do conteúdo; removido (era a mesma assinatura de landing gerada do
 * herói público e do admin — `docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §B3).
 * A entrada em fade+slide (`tw-animate-css`) continua: é sinal de movimento
 * sem depender de cor.
 *
 * `ToastProvider` entrou em 2026-09-21: `cadastro/formulario.tsx` ganhou `useToast()` para o
 * "reenviar e-mail" (BL-38) sem ninguém notar que nenhuma tela sem sessão embrulha em
 * `ToastProvider` — só `admin/layout.tsx` faz isso. `useToast()` lança de propósito fora do
 * provider ("nunca some calado"), e como é chamado incondicionalmente no topo do componente, a
 * PRIMEIRA renderização de `/cadastro` já derrubava a tela inteira pro `error.tsx` — nenhum
 * formulário aparecia, medido ao vivo. Aqui, não em cada página: a mesma armadilha existe pra
 * qualquer tela sem sessão que um dia precisar de toast, e o shell é o lugar certo de fechar a
 * classe inteira, não só o caso achado.
 *
 * A posição do viewport do toast (`toast.tsx`) supõe o chrome do painel: `--tabbar-h` (a barra
 * inferior) e `--sidebar-w` (a coluna lateral no monitor, via `lg:left-[var(--sidebar-w)]`).
 * Aqui não existe nenhum dos dois — sem zerar, o aviso nasceria com folga inferior de sobra no
 * celular e, no monitor, deslocado 232px para a direita do centro da tela (a mesma tela que
 * `justify-center` centraliza acima dele). Zerado aqui, no wrapper mais de fora: as duas
 * variáveis são só CSS custom properties, e cascata até o `Viewport` do toast (descendente),
 * sem `ToastProvider` precisar saber se está dentro do painel ou não.
 */
export default function TelaPublica({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ '--tabbar-h': '0px', '--sidebar-w': '0px' } as React.CSSProperties}>
      <ToastProvider>
        <main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden px-[18px] py-10">
          <div className="flex w-full animate-in flex-col items-center gap-6 fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </ToastProvider>
    </div>
  )
}
