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
    <form
      /*
        `onSubmit` e não `action`, e a diferença é medida: no React 19 um `<form action={fn}>`
        RESETA o formulário quando a ação termina, inclusive quando ela FALHOU. Conferido no
        navegador em 2026-09-03 na tela de entrar: errar a senha limpava e-mail E senha, e a
        pessoa tinha que redigitar o e-mail a cada tentativa.

        É um dos problemas de maior impacto em UX de login, e explica o "a etapa de login está
        muito ruim" que originou este conserto: cada erro custava o formulário inteiro.

        Nas quatro telas de autenticação o sucesso sempre navega para fora, então não existe
        caso em que limpar seja desejado: o reset era puro efeito colateral. `enviar` continua
        recebendo `FormData`, igual.
      */
      onSubmit={(e) => {
        e.preventDefault()
        void enviar(new FormData(e.currentTarget))
      }}
      className="flex w-full max-w-sm flex-col gap-3"
    >
      {/* TICKET-UX22: mesmo corte do cadastro — sem o texto de ajuda permanente, minLength 8. */}
      <Input rotulo="Senha nova" name="password" type="password" autoComplete="new-password" required minLength={8} />
      <Input rotulo="Repita a senha" name="confirmacao" type="password" autoComplete="new-password" required minLength={8} />
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
