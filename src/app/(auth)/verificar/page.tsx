import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { sessaoAtual } from '@/server/auth/session'

import FormularioVerificar from './formulario'

export default async function PaginaVerificar({
  searchParams,
}: {
  searchParams: Promise<{ factorId?: string; proximo?: string }>
}) {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/entrar')
  if (sessao.aal === 'aal2') redirect('/admin/hoje')

  const { factorId, proximo } = await searchParams
  if (!factorId) redirect('/entrar')

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        <h1 className="text-titulo font-bold">Confirmar identidade</h1>
        <p className="mt-1 text-secundario text-txt-2">Digite o código do seu app autenticador.</p>
      </div>
      <FormularioVerificar factorId={factorId} proximo={proximo ?? null} />
    </TelaPublica>
  )
}
