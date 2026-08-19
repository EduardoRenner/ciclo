import { redirect } from 'next/navigation'

import { sessaoAtual } from '@/server/auth/session'

import FormularioCadastro from './formulario'

export default async function PaginaCadastro() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/hoje')

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-[18px] py-10">
      <div className="text-center">
        <h1 className="text-titulo font-extrabold">Criar conta no CICLO</h1>
        <p className="mt-1 text-secundario text-txt-2">Leva menos de um minuto.</p>
      </div>
      <FormularioCadastro />
    </main>
  )
}
