import ToastProvider from '@/components/ui/toast'
import ResolucaoDeFila from '@/components/shell/resolucao-de-fila'
import TabBar from '@/components/shell/tab-bar'
import TransicaoDeTela from '@/components/shell/transicao-de-tela'
import Topbar from '@/components/shell/topbar'

import type { Metadata } from 'next'

/** Painel de trabalho, não vitrine — nunca deve aparecer numa busca (Gate 10). */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

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
        borda lateral (só a partir de `sm`) fecha a coluna como um aparelho.
        Havia também um brilho radial no topo (glow de template de landing
        gerada — `docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §B3); removido:
        profundidade agora vem só de superfície e sombra (Parte II §6).
      */}
      {/*
        No `lg` a navegação vira coluna à esquerda: o shell recua a largura dela e a coluna de
        conteúdo continua centralizada no espaço que sobra — o app deixa de ser uma tira de
        celular no meio do monitor sem que nada mude no celular.
      */}
      {/*
        Duas camadas de propósito: a de fora recua a largura da coluna de navegação (`lg`), a de
        dentro mantém o `mx-auto`. Feito com `ml` numa camada só, a margem explícita anulava o
        `auto` do outro lado e o conteúdo grudava na coluna, com 649px vazios à direita.
      */}
      <div className="lg:pl-[var(--sidebar-w)]">
      <div className="mx-auto min-h-dvh max-w-[560px] sm:border-x sm:border-line">
        <Topbar />
        {/*
          A folga inferior é a barra + o relevo do aparelho + respiro. Sai do
          token: era `pb-24` fixo, que já não batia com a barra de 82px e passou
          a errar de novo quando ela virou 64.
        */}
        <main className="px-[var(--gutter)] pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+28px)]">
          <TransicaoDeTela>{children}</TransicaoDeTela>
        </main>
      </div>
        {/* `fixed`: fica fora da coluna de conteúdo para poder virar barra lateral no `lg`. */}
        <TabBar />
        <ResolucaoDeFila />
      </div>
    </ToastProvider>
  )
}
