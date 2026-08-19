'use client'

import Link from 'next/link'
import { useState } from 'react'

import Button from '@/components/ui/button'

export default function FormularioCadastro() {
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
      <label className="flex flex-col gap-1">
        <span className="text-label font-semibold text-txt-2">Nome completo</span>
        <input
          name="fullName"
          autoComplete="name"
          required
          className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
        />
      </label>
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
        <span className="text-label font-semibold text-txt-2">Telefone com DDD</span>
        <input
          name="phone"
          type="tel"
          placeholder="(11) 99999-9999"
          autoComplete="tel"
          required
          className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label font-semibold text-txt-2">Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
        />
      </label>
      {erro ? <p className="text-secundario text-bad">{erro}</p> : null}
      <Button type="submit" largura="cheia" carregando={pendente}>
        Criar conta
      </Button>
      <Link href="/entrar" className="text-center text-secundario text-txt-2">
        Já tem conta? Entrar
      </Link>
    </form>
  )
}
