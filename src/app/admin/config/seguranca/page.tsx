import { criarClienteDoUsuario } from '@/server/db/server-client'
import { exigirSessao } from '@/server/auth/session'

import FormularioSeguranca from './formulario'
import PageHeader from '@/components/ui/page-header'

/** Sem `await`, viraria página estática — quebra o nonce do CSP por requisição. */
export const dynamic = 'force-dynamic'

export default async function PaginaSeguranca() {
  await exigirSessao()
  const db = await criarClienteDoUsuario()

  const { data } = await db.auth.mfa.listFactors()
  const fatores = (data?.totp ?? []).map((f) => ({ id: f.id, status: f.status, createdAt: f.created_at }))

  return (
    <>
      <PageHeader titulo="Segurança" descricao="Autenticação em duas etapas para a sua conta." />
      <FormularioSeguranca fatoresIniciais={fatores} />
    </>
  )
}
