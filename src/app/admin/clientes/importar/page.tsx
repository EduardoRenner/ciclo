import { headers } from 'next/headers'

import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarServicos } from '@/server/services/servicos'

import EsteiraDeImportacao from './esteira'
import PageHeader from '@/components/ui/page-header'

/** Mesma correção de `config/notificacoes/page.tsx` — sem fetch de servidor, o Next pré-renderizava estático e o nonce do CSP (por requisição) nunca batia com o carimbado no build. */
export const dynamic = 'force-dynamic'

export const metadata = { title: "Importar clientes" }

/**
 * docs/103 CNV-023: a tela única de trazer a clientela (substitui a de CSV com mapeamento de coluna).
 *
 * Os serviços chegam prontos do servidor porque "que serviço essas pessoas fazem" decide se a base
 * entra no Motor de Ciclo (sem ele, nenhum ciclo é gravado) e é o preço dele que a prévia usa para o
 * R$ parado. Só os com `cycle_days > 0`: serviço sem ritmo declarado não tem de quando prever.
 */
export default async function PaginaImportarClientes() {
  const ctx = await contextoDoPainel(new Request('https://interno/clientes/importar', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const servicos = await listarServicos(db, ctx.tenantId)

  const comRitmo = servicos
    .filter((s) => (s.cycle_days ?? 0) > 0)
    .map((s) => ({ id: s.id, nome: s.name, cycleDays: s.cycle_days as number, priceCents: s.price_cents ?? 0 }))

  return (
    <>
      <PageHeader titulo="Importar clientes" descricao="Traga a lista de onde ela estiver: planilha, contatos, conversa, PDF, print ou foto. Você confere antes de gravar." />

      <EsteiraDeImportacao servicos={comRitmo} timezone={ctx.tenant.timezone} />
    </>
  )
}
