import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { sessaoAtual } from '@/server/auth/session'

import FormularioNovaSenha from './formulario'

/**
 * Destino do link do e-mail de recuperação. Quem chega aqui já passou por
 * `/auth/callback`, que trocou o `code` do Supabase por sessão — é essa sessão
 * (e só ela) que `POST /auth/password/reset` exige. Sem sessão, o link expirou
 * ou foi aberto em outro aparelho: volta para pedir outro, em vez de mostrar um
 * formulário que falharia no envio.
 */
export default async function PaginaNovaSenha() {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/recuperar-senha?erro=link_expirado')

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        <h1 className="text-titulo font-bold">Criar senha nova</h1>
        <p className="mt-1 max-w-[34ch] text-secundario text-txt-2">
          Escolha uma senha que você use só aqui. Os outros aparelhos conectados vão cair.
        </p>
      </div>
      <FormularioNovaSenha />
    </TelaPublica>
  )
}
