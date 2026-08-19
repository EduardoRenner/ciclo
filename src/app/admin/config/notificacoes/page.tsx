import AtivarPush from './ativar'
import PageHeader from '@/components/ui/page-header'

/**
 * Página sem nenhum fetch de servidor, então o Next tentava pré-renderizar
 * como estática — mas o nonce do CSP (`src/middleware.ts`, TICKET-057) é
 * gerado por requisição, e o HTML estático carimba um nonce fixo do build.
 * Os dois nunca batem: todo script (inclusive o de hidratação do próprio
 * Next) é bloqueado em produção. Força renderização dinâmica pra sempre
 * carimbar o nonce certo. Achado ao vivo em produção, ver `docs/DECISOES.md`.
 */
export const dynamic = 'force-dynamic'

export default function PaginaNotificacoes() {
  return (
    <>
      <PageHeader titulo="Notificações" descricao="Web Push — funciona com o app instalado, mesmo em segundo plano." />

      <AtivarPush />
    </>
  )
}
