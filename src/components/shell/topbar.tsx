import { Settings } from 'lucide-react'
import Link from 'next/link'

/**
 * Barra fina de marca/orientação — o shell autenticado não tinha nenhuma
 * (achado da auditoria de UI): cada tela começava "fria" só com um `<h2>` de
 * seção, sem nada constante no topo pra ancorar onde a pessoa está. Não busca
 * dado nenhum de propósito — não pode virar fetch novo em toda tela do app.
 * A engrenagem é o único jeito de chegar em `/admin/config` hoje — nenhuma
 * outra tela linka pra lá.
 */
export default function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/80 px-[18px] py-3 backdrop-blur">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[linear-gradient(135deg,var(--acc),var(--acc-2))] text-label font-extrabold text-[#0a0a0f]">
        C
      </div>
      <span className="text-label font-semibold uppercase tracking-[0.13em] text-txt-3">CICLO</span>
      <Link
        href="/admin/config"
        aria-label="Configurações"
        className="ml-auto flex size-9 items-center justify-center rounded-[var(--radius-pill)] text-txt-3 transition hover:bg-surface-2 hover:text-txt-2"
      >
        <Settings aria-hidden className="size-5" />
      </Link>
    </header>
  )
}
