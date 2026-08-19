'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import Button from '@/components/ui/button'

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
      router.push(semNegocio ? '/onboarding' : (proximo ?? '/hoje'))
      router.refresh()
    } catch {
      setErro('Não consegui falar com o servidor. Tente de novo.')
    } finally {
      setPendente(false)
    }
  }

  return (
    <form action={enviar} className="flex w-full max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-label font-semibold text-txt-2">E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label font-semibold text-txt-2">Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
        />
      </label>
      {erro ? <p className="text-secundario text-bad">{erro}</p> : null}
      <Button type="submit" largura="cheia" carregando={pendente}>
        Entrar
      </Button>
      <Link href="/cadastro" className="text-center text-secundario text-txt-2">
        Não tem conta? Cadastre-se
      </Link>
    </form>
  )
}
