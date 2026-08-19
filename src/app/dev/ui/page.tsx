import { notFound } from 'next/navigation'
import { CalendarPlus, Users } from 'lucide-react'

import Vitrine from './vitrine'

/**
 * Vitrine dos componentes (TICKET-013). Fora de desenvolvimento ela não existe:
 * é página de trabalho, não faz parte do produto, e deixar rota de `/dev` aberta
 * em produção é superfície de graça para quem procura.
 */
export default function PaginaVitrine() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main className="mx-auto max-w-[430px] px-[18px] py-8">
      <header className="mb-6">
        <p className="text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
          Design system
        </p>
        <h1 className="mt-1 text-titulo font-bold">Componentes do CICLO</h1>
        <p className="mt-1 text-secundario text-txt-2">
          Tokens de <code>03-DESIGN-SYSTEM §1</code>. Largura travada em 430 px para conferir a
          regra dos 390 px.
        </p>
      </header>

      <Vitrine
        icones={{
          agenda: <CalendarPlus aria-hidden className="size-6" />,
          clientes: <Users aria-hidden className="size-6" />,
        }}
      />
    </main>
  )
}
