import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { sessaoAtual } from '@/server/auth/session'

import FormularioRecuperar from './formulario'

export const metadata = { title: "Recuperar senha" }

/**
 * A rota `/api/v1/auth/password/forgot` existia desde o TICKET-009 e nunca teve
 * tela: quem esquecia a senha não tinha caminho nenhum de volta para dentro do
 * produto — nem link em `/entrar`. Ver `docs/DECISOES.md` (2026-08-21).
 */
export default async function PaginaRecuperarSenha({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/admin/hoje')

  // `/nova-senha` manda para cá quando o link do e-mail já não vale — sem esta
  // linha a pessoa voltaria para o começo do fluxo sem entender por quê.
  const linkExpirado = (await searchParams).erro === 'link_expirado'

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        <h1 className="text-titulo font-bold">Esqueceu a senha?</h1>
        <p className="mt-1 max-w-[34ch] text-secundario text-txt-2">
          Diga o e-mail da sua conta e mandamos um link para você criar uma nova.
        </p>
      </div>
      {linkExpirado ? (
        <p role="alert" className="max-w-sm text-center text-secundario text-warn">
          Esse link não vale mais: eles expiram e só funcionam no aparelho em que você pediu. Peça outro abaixo.
        </p>
      ) : null}
      <FormularioRecuperar />
    </TelaPublica>
  )
}
