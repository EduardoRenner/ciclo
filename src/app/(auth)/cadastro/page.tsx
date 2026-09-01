import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { sessaoAtual } from '@/server/auth/session'

import LoginSocial from '../login-social'
import FormularioCadastro from './formulario'

export const metadata = { title: "Criar conta" }

export default async function PaginaCadastro() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/admin/hoje')

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        <h1 className="text-titulo font-bold">Criar conta no CICLO</h1>
        <p className="mt-1 text-secundario text-txt-2">Leva menos de um minuto.</p>
      </div>
      <LoginSocial />
      <FormularioCadastro />
    </TelaPublica>
  )
}
