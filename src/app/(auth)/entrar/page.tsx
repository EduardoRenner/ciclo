import { redirect } from 'next/navigation'

import { sessaoAtual } from '@/server/auth/session'

import FormularioEntrar from './formulario'

export default async function PaginaEntrar() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/hoje')

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-[18px]">
      <div className="text-center">
        <h1 className="text-titulo font-extrabold">CICLO</h1>
        <p className="mt-1 text-secundario text-txt-2">Entre para ver o resumo do seu dia.</p>
      </div>
      <FormularioEntrar />
    </main>
  )
}
