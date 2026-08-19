import { redirect } from 'next/navigation'

import { criarClienteDoUsuario } from '@/server/db/server-client'
import { sessaoAtual } from '@/server/auth/session'

import FormularioOnboarding from './formulario'

export default async function PaginaOnboarding() {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/entrar')

  const db = await criarClienteDoUsuario()
  const { data: vinculos } = await db.from('memberships').select('id').eq('user_id', sessao.userId).eq('active', true).limit(1)
  if (vinculos && vinculos.length > 0) redirect('/hoje')

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-[18px] py-10">
      <div className="text-center">
        <h1 className="text-titulo font-extrabold">Vamos criar seu negócio</h1>
        <p className="mt-1 text-secundario text-txt-2">Você poderá ajustar tudo isso depois.</p>
      </div>
      <FormularioOnboarding />
    </main>
  )
}
