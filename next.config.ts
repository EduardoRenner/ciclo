import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
