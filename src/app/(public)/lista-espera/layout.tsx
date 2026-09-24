import TelaDoCliente from '@/components/shell/tela-do-cliente'

/** Tela de link do cliente: mesmo tema claro da página do salão. Ver `components/shell/tela-do-cliente.tsx`. */
export default function LayoutDeLinkDoCliente({ children }: { children: React.ReactNode }) {
  return <TelaDoCliente>{children}</TelaDoCliente>
}
