import ToastProvider from '@/components/ui/toast'

/**
 * Shell das telas sem sessão (`/entrar`, `/cadastro`, `/onboarding`) — antes
 * disto cada uma era só texto centralizado num fundo preto sólido, sem
 * nenhuma identidade visual nem sinal de movimento. Tinha um brilho radial
 * atrás do conteúdo; removido (era a mesma assinatura de landing gerada do
 * herói público e do admin — `docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §B3).
 * A entrada em fade+slide (`tw-animate-css`) continua: é sinal de movimento
 * sem depender de cor.
 *
 * `data-theme="light"` entrou em 2026-09-21, pedido direto do Eduardo (com prova em screenshot):
 * o escuro nasceu como identidade de marca deliberada da "frente de casa" (ver `app/layout.tsx`),
 * mas a decisão foi revisada — quem chega em `/entrar`/`/cadastro`/`/onboarding` está preenchendo
 * campo de verdade, e a leitura ficou melhor clara. `/onboarding` tinha ganhado isso sozinha antes
 * (`onboarding/layout.tsx`, removido — este wrapper cobre o mesmo caso agora). A landing (`/`) não
 * usa este componente — tema dela em `app/page.tsx`, tratado à parte.
 *
 * `<style>` de fundo: `body`/`html` são ancestrais, fora do alcance da variável CSS — sem isto o
 * rubber-band do celular mostra o escuro do `:root` por baixo do conteúdo claro.
 *
 * `color`/`background` explícitos no `style` do wrapper, não só a variável: `body` (`app/layout.tsx`)
 * já declara `color: var(--txt)`, e `color` é HERDADO — não recalculado a cada `var()`. `body` fica
 * ACIMA deste `<div>` na árvore (o `<div>` é descendente, não ancestral), então o `--txt` que o
 * `body` resolve é o de `:root` (escuro) — a cor congela ali e desce por herança pra todo elemento
 * sem a própria classe de cor. Medido ao vivo: os três `<h1>` de `/entrar`/`/cadastro`/`/onboarding`
 * (nenhum tem `text-txt` — nunca precisou, a tela inteira sempre foi escura) saíam quase brancos
 * sobre fundo claro, ilegíveis. Redeclarar aqui reinicia a herança a partir do `<div>`.
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
    <div
      data-theme="light"
      style={{ '--tabbar-h': '0px', '--sidebar-w': '0px', color: 'var(--txt)', background: 'var(--bg)' } as React.CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#faf8f5}' }} />
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
