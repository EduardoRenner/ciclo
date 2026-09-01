import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

import RegistrarServiceWorker from "@/components/shell/registrar-service-worker";
import { APP_URL } from "@/lib/app-url";

/**
 * `force-dynamic` no layout raiz — herdado por TODA rota do app, sem exceção.
 *
 * Achado medindo produção ao vivo em 01/09/2026: o `middleware.ts` gera um nonce novo por
 * requisição e manda no header `Content-Security-Policy` (padrão oficial do Next.js para CSP com
 * nonce). Mas o Next.js "trava" — cacheia — o HTML de qualquer rota que não force renderização
 * dinâmica: o nonce que fica gravado no atributo `nonce="..."` de cada `<script>` do HTML é o da
 * PRIMEIRA renderização, e não muda mais. O header CSP da resposta, gerado fresco pelo middleware,
 * sim muda a cada chamada. Os dois nunca voltam a bater, e o navegador bloqueia TODO script —
 * `webpack.js`, `main-app.js`, o script de hidratação, tudo — em qualquer rota que não seja
 * genuinamente dinâmica.
 *
 * Isso não é hipótese: medido com `read_console_messages` no navegador de verdade, contra
 * produção, em `/` (que uma otimização de performance de 27/08 deixou estática de propósito),
 * `/precos`, `/privacidade`, `/termos` — e também em `/entrar`, que o `X-Vercel-Cache: MISS`
 * mostrava como "dinâmica" mas cujo nonce embutido no HTML ficava idêntico em três chamadas
 * seguidas, provando que o cache que quebra o nonce não é só o CDN da Vercel: é o Full Route
 * Cache do próprio Next.js, um nível que o header da Vercel não denuncia.
 *
 * O efeito prático: nenhuma tela pública do produto tinha JavaScript funcionando em produção —
 * agendamento online, login, cadastro, tudo sem interatividade nenhuma, só HTML morto. A
 * documentação oficial do Next.js é explícita sobre essa troca: nonce por requisição EXIGE
 * renderização dinâmica em toda rota que o usa, sem exceção — não existe meio-termo com cache
 * estático. Preferir o site funcionando (com o custo de perder cache/ISR em `/`, `/precos` etc.)
 * a manter a otimização de performance e ter metade do produto sem JavaScript.
 *
 * `docs/DECISOES.md` (01/09/2026) tem a medição completa e a decisão de reverter a otimização de
 * `/` (commit `cbe4d31`, "tira a landing do caminho dinamico") em vez de tentar consertar o cache.
 */
export const dynamic = "force-dynamic";

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

// O app é mobile-first e o tema escuro é o padrão; a barra do navegador acompanha.
export const viewport: Viewport = {
  themeColor: "#0d0c0c",
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
    <html lang="pt-BR" className="dark">
      <body className={`${archivo.variable} antialiased`}>
        <RegistrarServiceWorker />
        {children}
      </body>
    </html>
  );
}
