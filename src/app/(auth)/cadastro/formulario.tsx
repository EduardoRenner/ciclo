'use client'

import Link from 'next/link'
import { useState } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import PhoneInput from '@/components/ui/phone-input'

export default function FormularioCadastro() {
  const [telefone, setTelefone] = useState('')
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  async function enviar(formData: FormData) {
    setPendente(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.get('fullName'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          password: formData.get('password'),
        }),
      })
      const json = (await resposta.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
      if (!resposta.ok) {
        const primeiroCampo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(primeiroCampo ?? json.error?.message ?? 'Não consegui criar sua conta.')
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
      <p className="max-w-sm text-center text-corpo text-txt">
        Quase lá — mandamos um link de confirmação para o seu e-mail. Abra a mensagem e clique nele para continuar.
      </p>
    )
  }

  return (
    <form action={enviar} className="flex w-full max-w-sm flex-col gap-3">
      <Input rotulo="Nome completo" name="fullName" autoComplete="name" required />
      <Input rotulo="E-mail" name="email" type="email" autoComplete="email" required />
      <PhoneInput rotulo="Telefone com DDD" name="phone" valor={telefone} aoMudar={setTelefone} required />
      <Input
        rotulo="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        ajuda="No mínimo 10 caracteres."
      />
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      <Button type="submit" largura="cheia" carregando={pendente}>
        Criar conta
      </Button>
      <Link href="/entrar" className="grid h-12 place-items-center text-secundario text-txt-2 transition hover:text-txt">
        Já tem conta? <span className="ml-1 font-semibold text-acc-2">Entrar</span>
      </Link>
    </form>
  )
}
