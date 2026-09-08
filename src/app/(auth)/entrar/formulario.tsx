'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
// Função pura, sem I/O nem segredo: entra no bundle do cliente sem arrastar nada do servidor.
import { caminhoInternoSeguro } from '@/server/auth/destino'

/**
 * `/auth/callback` manda pessoas para cá com `?erro=` em dois casos: link de e-mail vencido ou
 * já usado (`link_invalido`) e login por Google/Apple cancelado ou negado (`login_cancelado`).
 * Os dois valores existiam antes deste mapa — o parâmetro chegava e nada na tela o lia, então a
 * pessoa via um formulário de login em branco sem entender por que voltou para cá.
 */
const MENSAGEM_DE_ERRO: Record<string, string> = {
  link_invalido: 'Esse link não é mais válido. Peça um novo.',
  login_cancelado: 'O login foi cancelado. Tente de novo quando quiser.',
}

export default function FormularioEntrar() {
  const router = useRouter()
  const params = useSearchParams()
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(() => {
    const codigo = params.get('erro')
    return codigo ? (MENSAGEM_DE_ERRO[codigo] ?? null) : null
  })

  async function enviar(formData: FormData) {
    setPendente(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: formData.get('email'), password: formData.get('password') }),
      })
      const json = (await resposta.json()) as {
        data?: { tenants: unknown[]; mfaRequired?: boolean; factorId?: string }
        error?: { message: string }
      }
      if (!resposta.ok) {
        setErro(json.error?.message ?? 'Não consegui entrar. Confira e-mail e senha.')
        return
      }

      /*
        `proximo` vem da query string, que qualquer um monta. Ia cru para `router.push`, e
        `router.push` navega para URL externa: `?proximo=https://evil.com/entrar` autenticava a
        pessoa no domínio de verdade e a jogava num clone no instante seguinte — bem quando ela
        acabou de digitar a senha e espera ver o painel. `caminhoInternoSeguro` resolve o
        candidato do mesmo jeito que o navegador resolveria e recusa tudo que sai do domínio,
        inclusive o `/\evil.com` que passa por checagem de prefixo.

        Sanitizado UMA vez, aqui, e não em cada uso: o valor também viaja para `/verificar` na
        query do MFA, e mandar o valor cru adiante seria só mudar o defeito de lugar.
      */
      const proximo = caminhoInternoSeguro(params.get('proximo'))

      if (json.data?.mfaRequired && json.data.factorId) {
        const destino = new URLSearchParams({ factorId: json.data.factorId, proximo })
        router.push(`/verificar?${destino.toString()}`)
        return
      }

      const semNegocio = (json.data?.tenants.length ?? 0) === 0
      router.push(semNegocio ? '/onboarding' : proximo)
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
      {/* A rota de recuperação existia desde o TICKET-009 sem nenhuma porta de entrada na interface. */}
      <Link
        href="/recuperar-senha"
        className="grid h-12 place-items-center text-secundario font-semibold text-acc-2 transition hover:brightness-110"
      >
        Esqueci minha senha
      </Link>
      <Link href="/cadastro" className="grid h-12 place-items-center text-secundario text-txt-2 transition hover:text-txt">
        Não tem conta? <span className="ml-1 font-semibold text-acc-2">Cadastre-se</span>
      </Link>
    </form>
  )
}
