import Importador from './importador'

/** Mesma correção de `config/notificacoes/page.tsx` — sem fetch de servidor, o Next pré-renderizava estático e o nonce do CSP (por requisição) nunca batia com o carimbado no build. */
export const dynamic = 'force-dynamic'

export default function PaginaImportarClientes() {
  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Importar clientes</h1>
        <p className="mt-1 text-secundario text-txt-2">
          Envie a planilha em CSV, diga qual coluna é qual e confira antes de importar de verdade.
        </p>
      </header>

      <Importador />
    </>
  )
}
