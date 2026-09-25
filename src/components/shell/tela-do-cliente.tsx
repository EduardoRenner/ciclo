/**
 * Wrapper das telas que o CLIENTE FINAL abre por link do WhatsApp: confirmar horário, avaliar, lista de
 * espera e orçamento.
 *
 * Elas não definiam tema e caíam no escuro do `:root`, mesmo com o aparelho em claro, enquanto a
 * página do salão que o cliente acabou de usar (`(public)/[slug]/layout.tsx`) é clara por pedido do
 * Eduardo. Quem recebia "confirme seu horário" saía de uma página clara para uma escura (medido a
 * 375 px, `docs/82` rodada 32). Aqui a regra é a mesma da página do salão: claro.
 *
 * `color`/`background` explícitos no wrapper, e o fundo de `html`/`body` estendido: as duas armadilhas
 * documentadas em `tests/unit/design/tema-alcanca-o-body.test.ts` (o `body` fica ACIMA do wrapper, então
 * variável CSS reescrita aqui dentro não sobe, e `color` é herdado já computado).
 */
export default function TelaDoCliente({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" style={{ color: 'var(--txt)', background: 'var(--bg)' } as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#faf8f5}' }} />
      {children}
    </div>
  )
}
