import Link from 'next/link'
import { redirect } from 'next/navigation'

import { sessaoAtual } from '@/server/auth/session'
import { withNovoTenant } from '@/server/db/with-tenant'
import { previaDoConvite } from '@/server/services/convites'

import AceitarConvite from './aceitar'

// Página com token: fora do buscador (mesma regra das outras páginas com token, APR-031).
export const metadata = { title: 'Convite para a equipe', robots: { index: false, follow: false } }

const NOME_DO_PAPEL = {
  owner: 'dona ou dono',
  manager: 'gerência',
  professional: 'profissional',
  reception: 'recepção',
  finance: 'financeiro',
} as const

/**
 * APR-023 (achado C-37): o convite gerava `/convite/{token}` e a página não existia — 404, e a
 * equipe não tinha como entrar. Sem sessão, vai para o login e volta para cá; com sessão, mostra de
 * qual negócio é o convite e o papel, e aceita com um toque.
 */
export default async function PaginaConvite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const previa = await withNovoTenant((svc) => previaDoConvite(svc, token))
  const aqui = `/convite/${encodeURIComponent(token)}`

  if (!previa) {
    return (
      <Moldura>
        <h1 className="text-titulo font-bold">Este convite não vale mais</h1>
        <p className="mt-2 text-corpo text-txt-2">Ele já foi usado ou venceu (o convite vale 7 dias). Peça um convite novo a quem te chamou.</p>
      </Moldura>
    )
  }

  const sessao = await sessaoAtual()
  if (!sessao) redirect(`/entrar?${new URLSearchParams({ proximo: aqui }).toString()}`)

  const papel = NOME_DO_PAPEL[previa.papel]
  if (sessao.email.toLowerCase() !== previa.email.toLowerCase()) {
    return (
      <Moldura>
        <h1 className="text-titulo font-bold">Este convite é para outro e-mail</h1>
        <p className="mt-2 text-corpo text-txt-2">
          {previa.negocio} chamou <strong>{previa.email}</strong> para a equipe. Você entrou como {sessao.email}.
        </p>
        <AceitarConvite token={token} modo="trocar-de-conta" voltarPara={aqui} />
      </Moldura>
    )
  }

  return (
    <Moldura>
      <h1 className="text-titulo font-bold">{previa.negocio} te chamou para a equipe</h1>
      <p className="mt-2 text-corpo text-txt-2">Você entra como {papel}. Dá para sair da equipe depois, em Configurações.</p>
      <AceitarConvite token={token} modo="aceitar" voltarPara={aqui} />
      <p className="mt-6 text-secundario text-txt-3">
        Não esperava este convite? <Link href="/" className="underline">Ir para o início</Link>
      </p>
    </Moldura>
  )
}

function Moldura({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-[18px] py-8">{children}</main>
}
