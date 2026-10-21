'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

import FormularioEntrar from './formulario'
import FormularioNumero from './formulario-numero'

/**
 * O número é o jeito principal de entrar (docs/110 L1); e-mail e senha continuam para quem já tem
 * conta assim. Quem chega com `?erro=` veio de um link de e-mail (confirmação, recuperação, login
 * social), então abre direto no e-mail, que é onde a mensagem desse erro mora.
 */
export default function JeitosDeEntrar() {
  const params = useSearchParams()
  const [modo, setModo] = useState<'numero' | 'email'>(() => (params.get('erro') ? 'email' : 'numero'))

  const trocar = (
    <button
      type="button"
      onClick={() => setModo(modo === 'numero' ? 'email' : 'numero')}
      className="grid h-12 w-full max-w-sm place-items-center text-secundario font-semibold text-acc-2 transition hover:brightness-110"
    >
      {modo === 'numero' ? 'Entrar com e-mail e senha' : 'Entrar com o número do WhatsApp'}
    </button>
  )

  if (modo === 'email') {
    return (
      <>
        <FormularioEntrar />
        {trocar}
      </>
    )
  }

  return (
    <>
      <FormularioNumero aoPedirEmail={() => setModo('email')} />
      {trocar}
      <p className="max-w-sm text-center text-label text-txt-3">Primeira vez? É o mesmo caminho: o código cria a sua conta.</p>
    </>
  )
}
