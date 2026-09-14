'use client'

import Link from 'next/link'
import { useState } from 'react'

import QuizShell from '@/components/shell/quiz-shell'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import PhoneInput from '@/components/ui/phone-input'
import SeletorProfissao, { type Profissao } from '@/components/ui/seletor-profissao'
import { NOME_DO_PLANO } from '@/core/billing/planos'
import { APP_HOST } from '@/lib/app-url'
import { salvarRascunhoOnboarding } from '@/lib/rascunho-onboarding'
import type { ProvedorSocial } from '@/server/auth/provedores-sociais'

import LoginSocial from '../login-social'

function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

const TOTAL_PASSOS = 4

/**
 * Cadastro em 4 telas (uma pergunta por vez) em vez do formulário único de antes — pedido do
 * Eduardo, inspirado em apps que adiam e-mail/senha para o fim (docs/DECISOES.md 14/09).
 *
 * O contrato com o servidor NÃO muda: `/api/v1/auth/signup` continua recebendo exatamente
 * {fullName, email, phone, password}, do jeito que já validava e mandava e-mail de confirmação.
 * Nome do negócio, profissão e endereço da página são coletados aqui mas só existem no
 * navegador até o fim — viram sessão de verdade só depois que a pessoa clica no link do
 * e-mail e cai em `/onboarding`, que lê o rascunho salvo (`rascunho-onboarding.ts`).
 *
 * Login social (Google etc.) continua no passo 1: quem escolhe esse caminho ganha sessão na
 * hora e cai direto no `/onboarding` de sempre, sem passar pelos passos 2-4 — não colide com
 * este fluxo, só o ignora.
 */
export default function FormularioCadastro({ profissoes, provedores }: { profissoes: Profissao[]; provedores: ProvedorSocial[] }) {
  const [passo, setPasso] = useState(0)
  const [nome, setNome] = useState('')
  const [professionId, setProfessionId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTocado, setSlugTocado] = useState(false)
  const [telefone, setTelefone] = useState('')
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  function aoMudarBusinessName(valor: string) {
    setBusinessName(valor)
    if (!slugTocado) setSlug(slugificar(valor))
  }

  function avancar() {
    setErro(null)
    setPasso((p) => Math.min(p + 1, TOTAL_PASSOS - 1))
  }

  function voltar() {
    setErro(null)
    setPasso((p) => Math.max(p - 1, 0))
  }

  if (enviado) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-[18px] py-10 text-center">
        <p className="max-w-sm text-corpo text-txt">
          Quase lá, {nome.split(' ')[0] || 'tudo certo'}! Mandamos um link de confirmação para o seu e-mail. Abra a mensagem e clique nele para continuar.
        </p>
      </main>
    )
  }

  return (
    <QuizShell passo={passo} total={TOTAL_PASSOS} aoVoltar={passo > 0 ? voltar : undefined}>
      {passo === 0 ? (
        <PassoNome
          nome={nome}
          aoMudar={setNome}
          aoContinuar={avancar}
          provedores={provedores}
        />
      ) : null}
      {passo === 1 ? (
        <PassoProfissao
          profissoes={profissoes}
          professionId={professionId}
          aoEscolher={setProfessionId}
          aoContinuar={avancar}
          erro={erro}
          aoErrar={setErro}
        />
      ) : null}
      {passo === 2 ? (
        <PassoNegocio
          businessName={businessName}
          aoMudarNome={aoMudarBusinessName}
          slug={slug}
          aoMudarSlug={(v) => {
            setSlugTocado(true)
            setSlug(slugificar(v))
          }}
          aoContinuar={avancar}
        />
      ) : null}
      {passo === 3 ? (
        <PassoConta
          nome={nome}
          telefone={telefone}
          aoMudarTelefone={setTelefone}
          professionId={professionId}
          businessName={businessName}
          slug={slug}
          pendente={pendente}
          erro={erro}
          aoEnviar={async (email, password) => {
            setPendente(true)
            setErro(null)
            try {
              const resposta = await fetch('/api/v1/auth/signup', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ fullName: nome, email, phone: telefone, password }),
              })
              const json = (await resposta.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
              if (!resposta.ok) {
                const primeiroCampo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
                setErro(primeiroCampo ?? json.error?.message ?? 'Não consegui criar sua conta.')
                return
              }
              salvarRascunhoOnboarding({ businessName, professionId, slug })
              setEnviado(true)
            } catch {
              setErro('Não consegui falar com o servidor. Tente de novo.')
            } finally {
              setPendente(false)
            }
          }}
        />
      ) : null}
    </QuizShell>
  )
}

function PassoNome({
  nome,
  aoMudar,
  aoContinuar,
  provedores,
}: {
  nome: string
  aoMudar: (v: string) => void
  aoContinuar: () => void
  provedores: ProvedorSocial[]
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (nome.trim()) aoContinuar()
      }}
      className="flex flex-1 flex-col gap-3"
    >
      <h1 className="text-titulo font-bold text-txt">Como podemos te chamar?</h1>
      <p className="text-secundario text-txt-2">Só isso por enquanto. E-mail e senha vêm no final.</p>
      <LoginSocial provedores={provedores} />
      <Input rotulo="Seu nome" value={nome} onChange={(e) => aoMudar(e.target.value)} required autoFocus />
      <div className="flex-1" />
      <Button type="submit" largura="cheia" disabled={!nome.trim()} motivoDesabilitado="Digite seu nome para continuar.">
        Continuar
      </Button>
      <Link href="/entrar" className="grid h-12 place-items-center text-secundario text-txt-2 transition hover:text-txt">
        Já tem conta? <span className="ml-1 font-semibold text-acc-2">Entrar</span>
      </Link>
    </form>
  )
}

function PassoProfissao({
  profissoes,
  professionId,
  aoEscolher,
  aoContinuar,
  erro,
  aoErrar,
}: {
  profissoes: Profissao[]
  professionId: string
  aoEscolher: (id: string) => void
  aoContinuar: () => void
  erro: string | null
  aoErrar: (msg: string | null) => void
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!professionId) {
          aoErrar('Escolha sua profissão na lista.')
          return
        }
        aoContinuar()
      }}
      className="flex flex-1 flex-col gap-3"
    >
      <h1 className="text-titulo font-bold text-txt">Qual é a sua profissão?</h1>
      <p className="text-secundario text-txt-2">É só o ponto de partida. Você ajusta serviços e horários depois.</p>
      <SeletorProfissao profissoes={profissoes} professionId={professionId || null} aoEscolher={aoEscolher} />
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      <div className="flex-1" />
      <Button type="submit" largura="cheia" disabled={!professionId} motivoDesabilitado="Escolha sua profissão para continuar.">
        Continuar
      </Button>
    </form>
  )
}

function PassoNegocio({
  businessName,
  aoMudarNome,
  slug,
  aoMudarSlug,
  aoContinuar,
}: {
  businessName: string
  aoMudarNome: (v: string) => void
  slug: string
  aoMudarSlug: (v: string) => void
  aoContinuar: () => void
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (businessName.trim() && slug.length >= 5) aoContinuar()
      }}
      className="flex flex-1 flex-col gap-3"
    >
      <h1 className="text-titulo font-bold text-txt">Como se chama o seu negócio?</h1>
      <Input rotulo="Nome do negócio" value={businessName} onChange={(e) => aoMudarNome(e.target.value)} required autoFocus />
      <Input
        rotulo="Endereço da sua página"
        prefixo={`${APP_HOST}/`}
        value={slug}
        onChange={(e) => aoMudarSlug(e.target.value)}
        required
        minLength={5}
        classNameCampo="tabular pl-[148px]"
        ajuda="É o link que você manda para agendar."
      />
      <div className="flex-1" />
      <Button
        type="submit"
        largura="cheia"
        disabled={!businessName.trim() || slug.length < 5}
        motivoDesabilitado={
          !businessName.trim() ? 'Digite o nome do negócio para continuar.' : 'O endereço da página precisa de pelo menos 5 caracteres.'
        }
      >
        Continuar
      </Button>
    </form>
  )
}

function PassoConta({
  nome,
  telefone,
  aoMudarTelefone,
  pendente,
  erro,
  aoEnviar,
}: {
  nome: string
  telefone: string
  aoMudarTelefone: (v: string) => void
  professionId: string
  businessName: string
  slug: string
  pendente: boolean
  erro: string | null
  aoEnviar: (email: string, password: string) => void
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const dados = new FormData(e.currentTarget)
        aoEnviar(String(dados.get('email')), String(dados.get('password')))
      }}
      className="flex flex-1 flex-col gap-3"
    >
      <h1 className="text-titulo font-bold text-txt">Falta pouco, {nome.split(' ')[0] || 'você'}</h1>
      {/*
        Movida de `cadastro/page.tsx` quando o cadastro virou quiz (docs/DECISOES.md 14/09) — a
        razão de existir não mudou: mata a objeção de "vai pedir cartão" bem no momento em que a
        pessoa está prestes a assinar, que segue sendo esta tela, só que agora é a última.
      */}
      <p className="text-secundario text-txt-2">
        Você começa no {NOME_DO_PLANO.gratis} e não pedimos cartão. Seu e-mail e uma senha para acessar sua conta.
      </p>
      <PhoneInput rotulo="Telefone com DDD" name="phone" valor={telefone} aoMudar={aoMudarTelefone} required />
      <Input rotulo="E-mail" name="email" type="email" autoComplete="email" required />
      <Input rotulo="Senha" name="password" type="password" autoComplete="new-password" required minLength={8} />
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      <div className="flex-1" />
      <Button type="submit" largura="cheia" carregando={pendente}>
        Criar conta
      </Button>
      <div className="text-center text-label text-txt-3">
        <p>Ao criar a conta você aceita:</p>
        <p className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2">
          <Link href="/termos" className="toque-48 -mx-2 px-2 font-semibold text-txt-2 underline underline-offset-2">
            Termos de uso
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacidade" className="toque-48 -mx-2 px-2 font-semibold text-txt-2 underline underline-offset-2">
            Política de Privacidade
          </Link>
        </p>
      </div>
    </form>
  )
}
