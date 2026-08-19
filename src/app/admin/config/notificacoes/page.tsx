import AtivarPush from './ativar'

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
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Notificações</h1>
        <p className="mt-1 text-secundario text-txt-2">Web Push — funciona com o app instalado, mesmo em segundo plano.</p>
      </header>

      <AtivarPush />
    </>
  )
}
