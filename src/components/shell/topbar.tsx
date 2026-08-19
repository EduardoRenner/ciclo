/**
 * Barra fina de marca/orientação — o shell autenticado não tinha nenhuma
 * (achado da auditoria de UI): cada tela começava "fria" só com um `<h2>` de
 * seção, sem nada constante no topo pra ancorar onde a pessoa está. Não busca
 * dado nenhum de propósito — não pode virar fetch novo em toda tela do app.
 */
export default function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/80 px-[18px] py-3 backdrop-blur">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[linear-gradient(135deg,var(--acc),var(--acc-2))] text-label font-extrabold text-[#0a0a0f]">
        C
      </div>
      <span className="text-label font-semibold uppercase tracking-[0.13em] text-txt-3">CICLO</span>
    </header>
  )
}
