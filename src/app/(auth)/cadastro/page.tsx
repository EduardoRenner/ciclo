import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { sessaoAtual } from '@/server/auth/session'

import FormularioCadastro from './formulario'

export default async function PaginaCadastro() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/admin/hoje')

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        <h1 className="text-titulo font-extrabold">Criar conta no CICLO</h1>
        <p className="mt-1 text-secundario text-txt-2">Leva menos de um minuto.</p>
      </div>
      <FormularioCadastro />
    </TelaPublica>
  )
}
