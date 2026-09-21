/**
 * `/onboarding` herdava o `<html className="dark">` do layout raiz sem nenhum jeito de sair dele —
 * `TelaPublica` (compartilhada com `/`, `/entrar`, `/cadastro`) não embrulha em `data-theme`, e o
 * escuro ali é identidade de marca de propósito (`app/layout.tsx`: "a landing, o login e a página
 * do salão são a frente de casa"). Onboarding é diferente: é a tela em que a pessoa está
 * preenchendo dado de verdade, a caminho do painel — pedido para ficar sempre clara, não escura
 * feito o resto da frente de casa.
 *
 * Mesmo mecanismo do `admin/layout.tsx` (`[data-theme="light"]` em `globals.css`), sem o cookie:
 * aqui não é preferência, é fixo.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light">
      {/* `body`/`html` são ancestrais, fora do alcance da variável — sem isto o rubber-band do
          celular mostra o escuro do `:root` por baixo. Mesmo truque do `admin/layout.tsx`. */}
      <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#faf8f5}' }} />
      {children}
    </div>
  )
}
