import TabBar from '@/components/shell/tab-bar'

/**
 * Shell do app do profissional (TICKET-014). O middleware já garante sessão
 * para tudo sob este grupo de rotas; aqui só entra layout, não guarda de novo.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-[560px]">
      {/* §3.3: tab bar de 82px exige essa folga, senão o fim da lista fica escondido atrás dela. */}
      <main className="px-[18px] pb-24">{children}</main>
      <TabBar />
    </div>
  )
}
