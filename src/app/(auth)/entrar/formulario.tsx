'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'

export default function FormularioEntrar() {
  const router = useRouter()
  const params = useSearchParams()
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(formData: FormData) {
    setPendente(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: formData.get('email'), password: formData.get('password') }),
      })
      const json = (await resposta.json()) as { data?: { tenants: unknown[] }; error?: { message: string } }
      if (!resposta.ok) {
        setErro(json.error?.message ?? 'Não consegui entrar. Confira e-mail e senha.')
        return
      }

      const proximo = params.get('proximo')
      const semNegocio = (json.data?.tenants.length ?? 0) === 0
      router.push(semNegocio ? '/onboarding' : (proximo ?? '/admin/hoje'))
      router.refresh()
    } catch {
      setErro('Não consegui falar com o servidor. Tente de novo.')
    } finally {
      setPendente(false)
    }
  }

  return (
    <form action={enviar} className="flex w-full max-w-sm flex-col gap-3">
      <Input rotulo="E-mail" name="email" type="email" autoComplete="email" required />
      <Input rotulo="Senha" name="password" type="password" autoComplete="current-password" required />
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      <Button type="submit" largura="cheia" carregando={pendente}>
        Entrar
      </Button>
      <Link href="/cadastro" className="grid h-12 place-items-center text-secundario text-txt-2 transition hover:text-txt">
        Não tem conta? <span className="ml-1 font-semibold text-acc-2">Cadastre-se</span>
      </Link>
    </form>
  )
}
