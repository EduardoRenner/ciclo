import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import RegistrarServiceWorker from "@/components/shell/registrar-service-worker";

const inter = Inter({
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
  themeColor: "#0a0a0f",
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
      <body className={`${inter.variable} antialiased`}>
        <RegistrarServiceWorker />
        {children}
      </body>
    </html>
  );
}
