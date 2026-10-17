import { headers } from 'next/headers'

import AtivarPush from './ativar'
import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import { ehRequisicaoDoAppNativo } from '@/core/plataforma/nativo'

/**
 * Página sem nenhum fetch de servidor, então o Next tentava pré-renderizar
 * como estática — mas o nonce do CSP (`src/middleware.ts`, TICKET-057) é
 * gerado por requisição, e o HTML estático carimba um nonce fixo do build.
 * Os dois nunca batem: todo script (inclusive o de hidratação do próprio
 * Next) é bloqueado em produção. Força renderização dinâmica pra sempre
 * carimbar o nonce certo. Achado ao vivo em produção, ver `docs/DECISOES.md`.
 */
export const dynamic = 'force-dynamic'

export const metadata = { title: "Notificações" }

/*
 * docs/98-aprimoramento/11 LOJA-24: o menu já esconde esta tela no app nativo, mas um link antigo ainda chega
 * aqui. Lá dentro não há Web Push, e o passo a passo do Safari que o componente mostrava no iPhone é o tipo de
 * tela que a Apple recusa (app que manda usar o site).
 */
export default async function PaginaNotificacoes() {
  const nativo = ehRequisicaoDoAppNativo((await headers()).get('user-agent'))

  return (
    <>
      <PageHeader titulo="Notificações" descricao="Avisos no aparelho, mesmo com o CICLO fechado." />

      {nativo ? (
        <Card>
          <p className="text-corpo font-semibold">Avisos no celular ainda não chegam pelo app</p>
          <p className="mt-1 text-secundario text-txt-2">Agenda, retornos e alertas continuam aparecendo na tela Hoje sempre que você abre o CICLO.</p>
        </Card>
      ) : (
        <AtivarPush />
      )}
    </>
  )
}
