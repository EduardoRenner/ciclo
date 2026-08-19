import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { sessaoAtual } from '@/server/auth/session'

import FormularioEntrar from './formulario'

export default async function PaginaEntrar() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/hoje')

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        <h1 className="text-titulo font-extrabold">CICLO</h1>
        <p className="mt-1 text-secundario text-txt-2">Entre para ver o resumo do seu dia.</p>
      </div>
      <FormularioEntrar />
    </TelaPublica>
  )
}
