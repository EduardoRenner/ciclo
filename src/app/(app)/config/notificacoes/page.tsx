import AtivarPush from './ativar'

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
