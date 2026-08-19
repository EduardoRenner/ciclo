import Importador from './importador'
import PageHeader from '@/components/ui/page-header'

/** Mesma correção de `config/notificacoes/page.tsx` — sem fetch de servidor, o Next pré-renderizava estático e o nonce do CSP (por requisição) nunca batia com o carimbado no build. */
export const dynamic = 'force-dynamic'

export default function PaginaImportarClientes() {
  return (
    <>
      <PageHeader titulo="Importar clientes" descricao="Envie a planilha em CSV, diga qual coluna é qual e confira antes de importar de verdade." />

      <Importador />
    </>
  )
}
