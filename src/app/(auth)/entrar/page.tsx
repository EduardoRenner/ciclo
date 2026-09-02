import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { provedoresSociaisAtivos } from '@/server/auth/provedores-sociais'
import { sessaoAtual } from '@/server/auth/session'

import LoginSocial from '../login-social'
import FormularioEntrar from './formulario'

export const metadata = { title: "Entrar" }

export default async function PaginaEntrar() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/admin/hoje')

  const provedores = await provedoresSociaisAtivos()

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        {/* O `Selo` (lockup completo) já diz "Ciclo" — repetir aqui era a mesma
            palavra duas vezes seguidas. As outras telas de `TelaPublica` têm
            título próprio (a pergunta é o que muda de tela pra tela); esta
            ganha o dela. */}
        <h1 className="text-titulo font-bold">Bem-vindo de volta</h1>
        <p className="mt-1 text-secundario text-txt-2">Entre para ver o resumo do seu dia.</p>
      </div>
      <LoginSocial provedores={provedores} />
      <FormularioEntrar />
    </TelaPublica>
  )
}
