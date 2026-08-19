import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

import RegistrarServiceWorker from "@/components/shell/registrar-service-worker";

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
  title: "CICLO",
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
