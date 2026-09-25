import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { PADRAO } from '@/core/text/vocabulario'
import { contextoAtual } from '@/server/auth/tenant'
import { AppError } from '@/server/http/errors'
import ToastProvider from '@/components/ui/toast'
import AssistenteFlutuante from '@/components/shell/assistente-flutuante'
import { VocabularioProvider } from '@/components/shell/vocabulario'
import ResolucaoDeFila from '@/components/shell/resolucao-de-fila'
import IndicadorDeConexao from '@/components/shell/indicador-de-conexao'
import TabBar from '@/components/shell/tab-bar'
import TransicaoDeTela from '@/components/shell/transicao-de-tela'
import Topbar from '@/components/shell/topbar'

import type { Metadata, Viewport } from 'next'

/** Painel de trabalho, não vitrine — nunca deve aparecer numa busca (Gate 10). */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * `force-dynamic` para TODO o painel (`perf/csp-duas-faixas`). Antes isto vivia no layout raiz e
 * pesava em `/`, `/precos` etc.; agora só o painel paga — e ele já é dinâmico de fato (este layout
 * lê `headers()` logo abaixo, e cada tela lê tenant). Cravar aqui garante que a CSP com nonce que
 * o `middleware.ts` serve para `/admin/*` sempre encontre HTML renderizado fresco, com o nonce do
 * header batendo com o do `<script>` — o descasamento de 01/09/2026 (`docs/DECISOES.md`) não pode
 * voltar por uma tela nova esquecer de forçar dinâmico.
 */
export const dynamic = 'force-dynamic'

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
/*
 * `contextoAtual` com `catch`, e o `catch` é a decisão: o layout renderiza em TODA rota de
 * `/admin`, inclusive nas que uma conta sem estabelecimento alcança antes de terminar o cadastro.
 * `contextoAtual` estoura `FORBIDDEN` nesse caso, e deixar isso subir aqui derrubaria o painel
 * inteiro para quem está no meio do onboarding. Sem contexto, o vocabulário é o padrão da casa.
 *
 * Não custa uma ida a mais ao banco: `vinculosAtivos` é `cache()` do React, então a página filha
 * que também chama `contextoAtual` reaproveita a mesma consulta na mesma requisição.
 *
 * **Achado em produção (16/09, via logs reais da Vercel): o `catch` sozinho não bastava.** Quem
 * cai aqui SEM nenhum estabelecimento nunca via este layout quebrar — via a PÁGINA FILHA quebrar,
 * porque cada `page.tsx` chama `contextoAtual` de novo, sem `catch`. O boundary de erro
 * (`admin/error.tsx`) então oferecia só "Tentar de novo" e "Ir para Hoje" — os dois batem na
 * MESMA falta de estabelecimento e devolvem a MESMA tela. Duas pessoas reais ficaram presas nesse
 * looping por até 12 dias sem nenhum caminho de saída. `FORBIDDEN` aqui só nasce de um jeito
 * (`server/auth/tenant.ts`: `ativos.length === 0`) — nunca de `TENANT_MISMATCH` (cookie de tenant
 * inválido) nem da validação de "escolha um estabelecimento" (múltiplos vínculos, `code` diferente)
 * — então checar o `code` antes de redirecionar não manda pro onboarding quem só precisa trocar de
 * aba ou escolher qual negócio usar.
 */
/**
 * Cor da barra do navegador no painel, pelo mesmo cookie `ciclo-tema` que decide o `data-theme` abaixo.
 * Sem isto a barra ficaria clara (padrão do layout raiz) sobre um painel que a pessoa escolheu escuro.
 * `sistema` volta a seguir o aparelho: só aí a barra troca por `prefers-color-scheme`.
 */
export async function generateViewport(): Promise<Viewport> {
  const cabecalhos = await headers()
  const escolha = cabecalhos.get('cookie')?.match(/(?:^|;\s*)ciclo-tema=(claro|escuro|sistema)/)?.[1]
  if (escolha === 'escuro') return { themeColor: '#0d0c0c' }
  if (escolha === 'sistema') {
    return {
      themeColor: [
        { media: '(prefers-color-scheme: dark)', color: '#0d0c0c' },
        { media: '(prefers-color-scheme: light)', color: '#faf8f5' },
      ],
    }
  }
  return { themeColor: '#faf8f5' }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cabecalhos = await headers()
  const ctx = await contextoAtual(new Request('https://interno/admin', { headers: cabecalhos })).catch((erro: unknown) => {
    if (erro instanceof AppError && erro.code === 'FORBIDDEN') redirect('/onboarding')
    return null
  })
  // Cookie `ciclo-tema` (o seletor em Configurações → Aparência grava): `claro` | `escuro` |
  // `sistema` | ausente. O wrapper abaixo carrega isso como `data-theme`, e o CSS de `globals.css`
  // decide a paleta a partir dali — no servidor, então não pisca.
  //
  // AUSENTE = CLARO (2026-09-23, pedido do Eduardo: "tudo no padrão claro"). Era `sistema`, e quem
  // tinha o celular em escuro criava a conta numa tela clara e caía num painel escuro. `sistema`
  // continua existindo, mas só quando a pessoa pede o Automático de propósito.
  const temaSalvo = cabecalhos.get('cookie')?.match(/(?:^|;\s*)ciclo-tema=(claro|escuro|sistema)/)?.[1]
  const dataTheme = temaSalvo === 'escuro' ? 'dark' : temaSalvo === 'sistema' ? 'sistema' : 'light'

  // O `<div>` abaixo pinta o próprio fundo; este `<style>` estende essa cor ao `<html>`/`<body>`
  // (ancestrais, fora do alcance da variável) para o rubber-band do celular não mostrar o escuro.
  // `style-src` da CSP permite inline — só `script-src` tem `strict-dynamic`.
  const corDeFundo = dataTheme === 'light' ? '#faf8f5' : dataTheme === 'dark' ? '#0d0c0c' : null

  return (
    /*
     * `ToastProvider` entra AQUI DENTRO, não por fora (era o contrário até 2026-09-13) — o toast
     * não usa `Toast.Portal` do Radix, então `Viewport`/`Root` nascem exatamente onde
     * `ToastProvider` fica na árvore. Com `ToastProvider` por fora de `#raiz-do-tema`, todo toast
     * era irmão do wrapper de tema, não descendente — e caía no fallback escuro de `:root` mesmo
     * com "Claro" escolhido de verdade. Mesma causa-raiz do `Sheet` (Radix `Portal` fora do
     * wrapper), medida no mesmo dia; ver `docs/DECISOES.md` 2026-09-13.
     */
    <div data-theme={dataTheme} id="raiz-do-tema" className="lg:pl-[var(--sidebar-w)]">
    <ToastProvider>
      {corDeFundo ? (
        <style dangerouslySetInnerHTML={{ __html: `html,body{background:${corDeFundo}}` }} />
      ) : null}
      <VocabularioProvider valor={ctx?.tenant.vocabulario ?? PADRAO}>
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
      <div className="mx-auto min-h-dvh max-w-[560px] sm:border-x sm:border-line">
        <Topbar />
        <IndicadorDeConexao />
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
        {/*
          docs/26-AGENTE-IA-PLANO.md §4.4/§7: `Boolean(process.env.GEMINI_API_KEY)` é leitura de
          variável de ambiente, não I/O — não transforma este layout num fetch novo por navegação
          (a mesma razão pela qual `Topbar` continua sem buscar dado). Sem chave, o componente
          nem monta o botão; o módulo desligado pelo dono ainda é pego dentro do painel, na
          primeira pergunta, porque isso sim depende de banco e de tenant.
        */}
        <AssistenteFlutuante disponivel={Boolean(process.env.GEMINI_API_KEY)} />
    </VocabularioProvider>
    </ToastProvider>
    </div>
  )
}
