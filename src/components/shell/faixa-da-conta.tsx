import Link from 'next/link'

import AlertBanner from '@/components/ui/alert-banner'
import type { FaixaDaConta as Faixa } from '@/core/billing/faixa-da-conta'

/**
 * A faixa de cortesia, graça e pausa (docs/87 §3.1). Componente de servidor, sem estado: o texto
 * vem pronto de `faixaDaConta` (função pura, com os testes de fronteira), e o toque sempre leva a
 * "Meu plano", onde a pessoa assina.
 *
 * `role="status"` e não `alert`: é aviso permanente da conta, não algo que interrompe quem está
 * atendendo. O estado nunca é só cor (o `AlertBanner` já põe o ícone por tom).
 */
export default function FaixaDaConta({ faixa }: { faixa: Faixa }) {
  return (
    <div className="px-[var(--gutter)] pt-3">
      <AlertBanner
        tom={faixa.tom}
        role="status"
        acao={
          <Link href="/admin/config/meu-plano" className="toque-48 inline-flex items-center text-acc-2">
            {faixa.acao}
          </Link>
        }
      >
        <p className="text-secundario">{faixa.texto}</p>
      </AlertBanner>
    </div>
  )
}
