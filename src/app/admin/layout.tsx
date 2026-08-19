import ToastProvider from '@/components/ui/toast'
import ResolucaoDeFila from '@/components/shell/resolucao-de-fila'
import TabBar from '@/components/shell/tab-bar'
import Topbar from '@/components/shell/topbar'

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
      {/*
        No monitor, o app é uma coluna de 560px sobre um fundo preto infinito —
        parecia inacabado justamente na tela em que o produto é demonstrado. A
        borda lateral (só a partir de `sm`) fecha a coluna como um aparelho, e o
        brilho de acento no topo dá profundidade sem imagem nem custo de rede.
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 hidden sm:block"
        style={{ background: 'radial-gradient(70% 40% at 50% -10%, var(--acc-soft), transparent 70%)' }}
      />
      <div className="mx-auto min-h-dvh max-w-[560px] sm:border-x sm:border-line">
        <Topbar />
        {/*
          A folga inferior é a barra + o relevo do aparelho + respiro. Sai do
          token: era `pb-24` fixo, que já não batia com a barra de 82px e passou
          a errar de novo quando ela virou 64.
        */}
        <main className="px-[var(--gutter)] pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+28px)]">
          {children}
        </main>
        <TabBar />
        <ResolucaoDeFila />
      </div>
    </ToastProvider>
  )
}
