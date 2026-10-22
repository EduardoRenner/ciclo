'use client'

import { useState } from 'react'

import FormularioEntrar from './formulario'
import FormularioNumero from './formulario-numero'

/**
 * docs/114 L-03 e docs/119: entrar é com número e senha; o código pelo WhatsApp é o segundo
 * caminho, para quem não lembra a senha ou prefere não digitar. Ele só aparece quando o envio está
 * configurado (Twilio Verify), e o servidor só manda código para número que já tem cadastro.
 */
export default function JeitosDeEntrar({ numeroDisponivel }: { numeroDisponivel: boolean }) {
  const [modo, setModo] = useState<'numero' | 'senha'>('senha')

  // Sem envio de código configurado, o código não aparece: oferecer uma porta que sempre falha prende a pessoa.
  if (!numeroDisponivel) return <FormularioEntrar />

  const trocar = (
    <button
      type="button"
      onClick={() => setModo(modo === 'numero' ? 'senha' : 'numero')}
      className="grid h-12 w-full max-w-sm place-items-center text-secundario font-semibold text-acc-2 transition hover:brightness-110"
    >
      {modo === 'numero' ? 'Entrar com senha' : 'Receber um código no WhatsApp'}
    </button>
  )

  if (modo === 'senha') {
    return (
      <>
        <FormularioEntrar />
        {trocar}
      </>
    )
  }

  return (
    <>
      <FormularioNumero aoPedirEmail={() => setModo('senha')} />
      {trocar}
    </>
  )
}
