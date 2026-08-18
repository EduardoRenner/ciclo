import ToastProvider from '@/components/ui/toast'
import ResolucaoDeFila from '@/components/shell/resolucao-de-fila'
import TabBar from '@/components/shell/tab-bar'

/**
 * Shell do app do profissional (TICKET-014). O middleware já garante sessão
 * para tudo sob este grupo de rotas; aqui só entra layout, não guarda de novo.
 *
 * `ToastProvider` precisa envolver `{children}` aqui, não em cada tela: sem
 * ele, `useToast()` só quebrava em telas 100% estáticas (`/clientes/importar`,
 * sem `cookies()`/`headers()`) — o Next tenta pré-renderizar essas em build e
 * estoura ali; telas dinâmicas escondiam o mesmo bug até alguém clicar o botão
 * de toast em produção.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="mx-auto min-h-dvh max-w-[560px]">
        {/* §3.3: tab bar de 82px exige essa folga, senão o fim da lista fica escondido atrás dela. */}
        <main className="px-[18px] pb-24">{children}</main>
        <TabBar />
        <ResolucaoDeFila />
      </div>
    </ToastProvider>
  )
}
