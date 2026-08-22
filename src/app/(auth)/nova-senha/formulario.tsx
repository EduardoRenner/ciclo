'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'

export default function FormularioNovaSenha() {
  const router = useRouter()
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(formData: FormData) {
    const senha = String(formData.get('password') ?? '')
    if (senha !== String(formData.get('confirmacao') ?? '')) {
      setErro('As duas senhas estão diferentes.')
      return
    }

    setPendente(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/v1/auth/password/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: senha }),
      })
      const json = (await resposta.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
      if (!resposta.ok) {
        const primeiroCampo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(primeiroCampo ?? json.error?.message ?? 'Não consegui trocar a senha.')
        return
      }
      router.push('/admin/hoje')
      router.refresh()
    } catch {
      setErro('Não consegui falar com o servidor. Tente de novo.')
    } finally {
      setPendente(false)
    }
  }

  return (
    <form action={enviar} className="flex w-full max-w-sm flex-col gap-3">
      <Input
        rotulo="Senha nova"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        ajuda="No mínimo 10 caracteres."
      />
      <Input rotulo="Repita a senha" name="confirmacao" type="password" autoComplete="new-password" required minLength={10} />
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      <Button type="submit" largura="cheia" carregando={pendente}>
        Salvar senha nova
      </Button>
    </form>
  )
}
