import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

import RegistrarServiceWorker from "@/components/shell/registrar-service-worker";
import { APP_URL } from "@/lib/app-url";

/**
 * O layout raiz NÃO força renderização dinâmica — de propósito, e essa escolha tem história.
 *
 * Em 01/09/2026 (`docs/DECISOES.md`) o site inteiro ficou sem JavaScript em produção: o
 * `middleware.ts` mandava um nonce NOVO por requisição no header CSP, mas o Next.js cacheava o
 * HTML das rotas estáticas — o nonce gravado nos `<script>` congelava na primeira renderização, o
 * header mudava a cada chamada, os dois nunca batiam, o navegador bloqueava tudo. O conserto de
 * então foi um `export const dynamic = 'force-dynamic'` AQUI, herdado por toda rota — tirava o
 * cache de `/`, `/precos` etc. para o nonce voltar a bater.
 *
 * A solução real, `perf/csp-duas-faixas`: a raiz do descasamento não é o cache, é o NONCE numa
 * página cacheada. O `middleware.ts` passou a servir uma CSP **sem nonce** para as quatro rotas
 * de conteúdo estático (`ROTAS_DE_CONTEUDO_ESTATICO`: `/`, `/precos`, `/privacidade`, `/termos`) —
 * sem nonce não há valor para congelar, a CSP é idêntica em toda resposta, e essas páginas podem
 * voltar ao CDN. O `force-dynamic` mudou de casa: agora vive em `src/app/admin/layout.tsx` e
 * cobre todo o painel; `(auth)` e `[slug]` já são dinâmicas por lerem sessão/tenant.
 *
 * Guardado em `tests/unit/design/csp-nonce-exige-rota-dinamica.test.ts`.
 */

/**
 * Inter é a fonte de "nenhuma decisão foi tomada" — é o default de praticamente
 * todo produto gerado (`docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §D1). Archivo
 * é neutra nos dois sentidos que este produto precisa (cabe numa barbearia sem
 * ler masculino, é limpa o bastante para um estúdio de unhas), tem numerais bem
 * desenhados — crítico em horário (`11:15`/`17:00`) — e o eixo de peso/largura
 * dá uma segunda dimensão de hierarquia sem precisar de segunda família.
 * `next/font/google` baixa e auto-hospeda no build: nenhuma requisição a
 * fonts.googleapis.com em produção, a CSP não muda.
 */
const archivo = Archivo({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  /*
   * `template` em vez de um título só: as 29 telas de `/admin` herdavam
   * "CICLO" e nenhuma dizia onde a pessoa estava. Isso não é detalhe de SEO —
   * `/admin` nem é indexável. É que no App Router a navegação é no cliente, e
   * o `<title>` é o que o leitor de tela anuncia quando a rota troca: com o
   * mesmo texto em todas, quem não enxerga não recebe confirmação nenhuma de
   * que saiu do lugar (WCAG 2.4.2). Instalado como PWA, é também o nome da
   * janela e do item no alternador de apps.
   */
  /*
   * `metadataBase` faltava, e sem ele TODO caminho relativo de imagem em `openGraph` fica
   * relativo — o WhatsApp e o Instagram não resolvem, e o link colado aparece sem prévia
   * nenhuma. Para um produto cujo canal de aquisição é justamente o link mandado no WhatsApp
   * para outro profissional, isso é a vitrine fechada.
   */
  metadataBase: new URL(APP_URL),
  title: { default: "CICLO", template: "%s · CICLO" },
  description:
    "Gestão para profissionais da beleza: agenda, Motor de Ciclo e recuperação de receita.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CICLO",
  },
};

// O escuro é o padrão; a barra do navegador acompanha o tema do sistema. A escolha explícita do
// seletor não passa por aqui (viewport é estático) — o `seletor-de-tema` reescreve a
// <meta name="theme-color"> quando troca.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0c0c" },
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      {/*
        Sem `className="dark"`: o tema é decidido pelo `:root` (escuro, padrão), pelo `@media` do
        `globals.css` (modo sistema) ou por `data-theme` (escolha explícita). O script anti-flash
        que aplica a escolha salva antes da pintura vive em `admin/layout.tsx` — só ali há a
        `headers()` de onde tirar o nonce do CSP, e é só ali que o seletor de tema existe.
      */}
      <body className={`${archivo.variable} antialiased`}>
        <RegistrarServiceWorker />
        {children}
      </body>
    </html>
  );
}
