'use client'

import Link from 'next/link'
import { useState } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'

export default function FormularioRecuperar() {
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  async function enviar(formData: FormData) {
    setPendente(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/v1/auth/password/forgot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: formData.get('email') }),
      })
      const json = (await resposta.json()) as { error?: { message: string } }
      if (!resposta.ok) {
        setErro(json.error?.message ?? 'Não consegui enviar o link. Tente de novo.')
        return
      }
      setEnviado(true)
    } catch {
      setErro('Não consegui falar com o servidor. Tente de novo.')
    } finally {
      setPendente(false)
    }
  }

  if (enviado) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3 text-center">
        {/*
          A resposta do servidor é a mesma exista ou não a conta (senão a tela
          vira uma lista de quem usa o CICLO) — então o texto aqui também não
          pode afirmar que o e-mail foi enviado para uma conta que existe.
        */}
        <p className="text-corpo text-txt">
          Se esse e-mail tem conta no CICLO, o link para criar uma senha nova já está a caminho. Abra a mensagem no
          mesmo aparelho em que você pediu.
        </p>
        <Link href="/entrar" className="grid h-12 place-items-center text-secundario font-semibold text-acc-2">
          Voltar para entrar
        </Link>
      </div>
    )
  }

  return (
    <form action={enviar} className="flex w-full max-w-sm flex-col gap-3">
      <Input rotulo="E-mail" name="email" type="email" autoComplete="email" required />
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      <Button type="submit" largura="cheia" carregando={pendente}>
        Mandar link
      </Button>
      <Link href="/entrar" className="grid h-12 place-items-center text-secundario text-txt-2 transition hover:text-txt">
        Lembrou? <span className="ml-1 font-semibold text-acc-2">Entrar</span>
      </Link>
    </form>
  )
}
