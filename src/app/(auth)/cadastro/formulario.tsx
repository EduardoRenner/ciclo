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
        Quase lá! Mandamos um link de confirmação para o seu e-mail. Abra a mensagem e clique nele para continuar.
      </p>
    )
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
      {/*
        O contrato se forma AQUI, e esta tela não dizia isso nem linkava para lugar nenhum. Os
        termos afirmam "ao criar uma conta, você concorda com estes termos" e a política de
        privacidade descreve tratamento de dado sensível de saúde — os dois existem desde 30/08 e
        só eram alcançáveis pela landing e pela página de preço, que ninguém precisa visitar para
        chegar até este botão (o link de convite e o `/entrar` levam direto).

        Fica ABAIXO do botão, não acima, e sem caixa de marcar: a lei brasileira aceita o aceite
        pelo próprio ato de contratar quando os termos estão à vista, e uma caixa a mais num
        formulário de quatro campos é atrito que não protege ninguém.
      */}
      {/*
        Os links ficam numa LINHA PRÓPRIA, e não dentro da frase, por um motivo medido.

        A primeira versão punha os dois no meio do texto com `toque-48` em cada. Sondando ponto a
        ponto (a receita do docstring de `alvo-de-toque-tem-48`), o resultado foi: "Termos de uso"
        com 49 px efetivos e **"Política de Privacidade" com ZERO**. Os dois começam na mesma linha,
        e o `::after` absoluto de 48 px do primeiro cobre o segundo inteiro — o link ficou
        intocável, o que é muito pior que o alvo de 14 px que eu estava consertando.

        `toque-48` só é seguro quando os elementos não dividem linha de texto corrida. É por isso
        que os rodapés da landing e de `/precos` funcionam: lá é uma `flex` com `gap`, que é o
        mesmo desenho adotado aqui. A guarda do fonte não pega isto (ela confere se a classe está
        lá, não se o alvo resultante é alcançável), então fica registrado no lugar onde o erro
        aconteceu.
      */}
      <div className="text-center text-label text-txt-3">
        <p>Ao criar a conta você aceita:</p>
        <p className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2">
          <Link href="/termos" className="toque-48 font-semibold text-txt-2 underline underline-offset-2">
            Termos de uso
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacidade" className="toque-48 font-semibold text-txt-2 underline underline-offset-2">
            Política de Privacidade
          </Link>
        </p>
      </div>
      <Link href="/entrar" className="grid h-12 place-items-center text-secundario text-txt-2 transition hover:text-txt">
        Já tem conta? <span className="ml-1 font-semibold text-acc-2">Entrar</span>
      </Link>
    </form>
  )
}
