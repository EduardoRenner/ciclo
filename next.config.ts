import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Identificador de build exposto ao cliente (docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md
   * T1): é o que faz o service worker trocar de nome de cache a cada deploy,
   * em vez de depender de alguém lembrar de incrementar uma string à mão —
   * foi exatamente essa string digitada (`ciclo-v2`, parada desde 19/08) que
   * deixou o app roxo preso no cache de quem visitou antes do redesign.
   *
   * `VERCEL_GIT_COMMIT_SHA` só existe quando o deploy nasce de uma integração
   * git. Até 2026-08-26 este projeto fazia `vercel --prod` direto do CLI e a
   * variável vinha como string VAZIA — não ausente, e `??` não pega string
   * vazia, que foi o achado do primeiro deploy desta correção. Desde que o
   * repositório foi conectado (`vercel git connect`, prioridade 1 da auditoria
   * de `docs/26`), o SHA passa a existir de verdade nos deploys de `main`; o
   * encadeamento abaixo continua valendo para deploy manual. `VERCEL_URL` é a rede de
   * segurança: todo deploy da Vercel recebe uma URL com hash próprio
   * (`ciclo-<hash>-starkinovacoes.vercel.app`), git ou não, e isso já basta
   * para o nome do cache mudar a cada vez. `||` em vez de `??` de propósito:
   * cobre string vazia além de `undefined`.
   */
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_URL || "dev",
  },
  // O app do profissional morava na raiz (`/hoje`, `/agenda`...) e mudou pra
  // `/admin/*` — favoritos e o PWA já instalado no celular apontam pro
  // endereço velho. Redirect permanente, não um `notFound()`.
  async redirects() {
    const prefixosAntigos = ["hoje", "agenda", "clientes", "recuperar", "comanda", "caixa", "config"];
    return prefixosAntigos.map((prefixo) => ({
      source: `/${prefixo}/:path*`,
      destination: `/admin/${prefixo}/:path*`,
      permanent: true,
    }));
  },
};

// TICKET-057. Sem `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` (nenhum
// credencial de terceiro deste projeto ainda foi provisionado pelo Eduardo —
// mesmo padrão do Asaas/WhatsApp), o plugin pula sozinho o upload de source
// map e só avisa no log do build; não falha o build por isso.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
