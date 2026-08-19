import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { sessaoAtual } from '@/server/auth/session'

import FormularioOnboarding from './formulario'

export default async function PaginaOnboarding() {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/entrar')

  const db = await criarClienteDoUsuario()
  const { data: vinculos } = await db.from('memberships').select('id').eq('user_id', sessao.userId).eq('active', true).limit(1)
  if (vinculos && vinculos.length > 0) redirect('/admin/hoje')

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        <h1 className="text-titulo font-extrabold">Vamos criar seu negócio</h1>
        <p className="mt-1 text-secundario text-txt-2">Você poderá ajustar tudo isso depois.</p>
      </div>
      <FormularioOnboarding />
    </TelaPublica>
  )
}
