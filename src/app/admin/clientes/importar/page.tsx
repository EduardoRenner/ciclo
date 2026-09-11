import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarServicos } from '@/server/services/servicos'

import Importador from './importador'
import PageHeader from '@/components/ui/page-header'

/** Mesma correção de `config/notificacoes/page.tsx` — sem fetch de servidor, o Next pré-renderizava estático e o nonce do CSP (por requisição) nunca batia com o carimbado no build. */
export const dynamic = 'force-dynamic'

export const metadata = { title: "Importar clientes" }

/**
 * Os serviços chegam prontos do servidor porque o campo "que serviço essas pessoas fazem" é o que
 * decide se a base importada entra ou não no Motor de Ciclo — e um `<select>` que só se popula
 * depois de um fetch do cliente é um campo que a pessoa pula sem ver.
 *
 * Só os com `cycle_days > 0` aparecem: serviço sem ritmo declarado não tem de quanto em quanto
 * tempo prever, e oferecer um deles aqui produziria um ciclo sem sentido.
 */
export default async function PaginaImportarClientes() {
  const ctx = await contextoAtual(new Request('https://interno/clientes/importar', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const servicos = await listarServicos(db, ctx.tenantId)

  const comRitmo = servicos
    .filter((s) => (s.cycle_days ?? 0) > 0)
    .map((s) => ({ id: s.id, nome: s.name, cycleDays: s.cycle_days as number }))

  return (
    <>
      <PageHeader titulo="Importar clientes" descricao="Envie a planilha em CSV, diga qual coluna é qual e confira antes de importar de verdade." />

      <Importador servicos={comRitmo} />
    </>
  )
}
