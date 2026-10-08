import { criarClienteDoUsuario } from '@/server/db/server-client'
import { exigirSessao } from '@/server/auth/session'

import FormularioSeguranca from './formulario'
import PageHeader from '@/components/ui/page-header'

/** Sem `await`, viraria página estática — quebra o nonce do CSP por requisição. */
export const dynamic = 'force-dynamic'

export const metadata = { title: "Segurança" }

export default async function PaginaSeguranca({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  // Só `exigirSessao`, nunca `contextoDoPainel`: esta é a tela para onde a porta de segundo fator do
  // pacote manda (docs/101 T0.4). Passar por aquela porta aqui faria o redirecionamento virar laço.
  await exigirSessao()
  const db = await criarClienteDoUsuario()

  const [{ data }, { motivo }] = await Promise.all([db.auth.mfa.listFactors(), searchParams])
  const fatores = (data?.totp ?? []).map((f) => ({ id: f.id, status: f.status, createdAt: f.created_at }))
  const jaTemFator = fatores.some((f) => f.status === 'verified')

  return (
    <>
      <PageHeader titulo="Segurança" descricao="Autenticação em duas etapas para a sua conta." />
      {motivo === 'pacote' ? (
        <p role="status" className="mb-4 rounded-[var(--radius-sm)] bg-warn/10 p-3 text-secundario text-txt">
          {jaTemFator
            ? 'Este escritório exige segundo fator. Saia e entre de novo para confirmar o código do seu app autenticador.'
            : 'Este escritório exige segundo fator. Ative para continuar.'}
        </p>
      ) : null}
      <FormularioSeguranca fatoresIniciais={fatores} />
    </>
  )
}
