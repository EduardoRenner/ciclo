'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import { formatarTelefone, telefoneParaE164 } from '@/core/text/telefone'
import { caminhoInternoSeguro } from '@/server/auth/destino'

/** Nome e número da última vez, para quem volta não digitar de novo. Só neste aparelho. */
const CHAVE_LEMBRADO = 'ciclo:entrar-com-numero'
const ESPERA_PARA_REENVIAR_S = 30

type Lembrado = { nome: string; telefone: string }

function lerLembrado(): Lembrado | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_LEMBRADO)
    return bruto ? (JSON.parse(bruto) as Lembrado) : null
  } catch {
    return null
  }
}

function guardarLembrado(l: Lembrado): void {
  try {
    window.localStorage.setItem(CHAVE_LEMBRADO, JSON.stringify(l))
  } catch {
    // Navegador sem armazenamento (aba anônima): a pessoa só digita de novo na próxima vez.
  }
}

type Resposta = {
  data?: { tenants?: unknown[]; mfaRequired?: boolean; factorId?: string }
  error?: { code?: string; message: string }
}

/**
 * Login por número (docs/110 L1): nome e WhatsApp, depois o código de 6 dígitos que chega lá.
 * `aoPedirEmail` troca para o formulário de e-mail, que é a saída quando o número já está numa
 * conta com e-mail ou quando o código não sai.
 */
export default function FormularioNumero({ aoPedirEmail }: { aoPedirEmail: () => void }) {
  const router = useRouter()
  const params = useSearchParams()
  const [etapa, setEtapa] = useState<'numero' | 'codigo'>('numero')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [codigo, setCodigo] = useState('')
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarEmail, setMostrarEmail] = useState(false)
  const [espera, setEspera] = useState(0)

  useEffect(() => {
    const l = lerLembrado()
    if (l) {
      setNome(l.nome)
      setTelefone(formatarTelefone(l.telefone) ?? l.telefone)
    }
  }, [])

  useEffect(() => {
    if (espera <= 0) return
    const t = window.setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [espera])

  async function pedirCodigo() {
    setErro(null)
    setMostrarEmail(false)
    const e164 = telefoneParaE164(telefone)
    if (!e164) {
      setErro('Digite o WhatsApp com DDD, como (11) 99999-9999.')
      return
    }
    setPendente(true)
    try {
      const r = await fetch('/api/v1/auth/codigo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telefone: e164, nome }),
      })
      const json = (await r.json()) as Resposta
      if (!r.ok) {
        setErro(json.error?.message ?? 'Não consegui mandar o código. Tente de novo.')
        return
      }
      guardarLembrado({ nome, telefone: e164 })
      setEtapa('codigo')
      setCodigo('')
      setEspera(ESPERA_PARA_REENVIAR_S)
    } catch {
      setErro('Não consegui falar com o servidor. Tente de novo.')
    } finally {
      setPendente(false)
    }
  }

  async function entrar() {
    setErro(null)
    const e164 = telefoneParaE164(telefone)
    if (!e164) return
    setPendente(true)
    try {
      const r = await fetch('/api/v1/auth/codigo/entrar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telefone: e164, codigo }),
      })
      const json = (await r.json()) as Resposta
      if (!r.ok) {
        setErro(json.error?.message ?? 'Não consegui entrar. Confira o código.')
        if (json.error?.code === 'PHONE_IN_EMAIL_ACCOUNT') setMostrarEmail(true)
        return
      }

      const proximo = caminhoInternoSeguro(params.get('proximo'))
      if (json.data?.mfaRequired && json.data.factorId) {
        router.push(`/verificar?${new URLSearchParams({ factorId: json.data.factorId, proximo }).toString()}`)
        return
      }
      const semNegocio = (json.data?.tenants?.length ?? 0) === 0
      router.push(semNegocio && !proximo.startsWith('/convite/') ? '/onboarding' : proximo)
      router.refresh()
    } catch {
      setErro('Não consegui falar com o servidor. Tente de novo.')
    } finally {
      setPendente(false)
    }
  }

  // Só na conta de e-mail que já tem o número: ali o e-mail é o único caminho, e o botão dá o passo
  // pela pessoa. Nos outros erros o "Entrar com e-mail e senha" logo abaixo já basta.
  const saidaParaEmail = mostrarEmail ? (
    <Button type="button" variante="secondary" largura="cheia" onClick={aoPedirEmail}>
      Entrar com e-mail
    </Button>
  ) : null

  if (etapa === 'codigo') {
    return (
      <form
        method="post"
        onSubmit={(e) => {
          e.preventDefault()
          void entrar()
        }}
        className="flex w-full max-w-sm flex-col gap-3"
      >
        <p className="text-secundario text-txt-2">
          Mandamos um código de 6 números no WhatsApp {formatarTelefone(telefoneParaE164(telefone)) ?? telefone}.
        </p>
        <Input
          rotulo="Código"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        {erro ? (
          <p role="alert" className="text-secundario text-bad">
            {erro}
          </p>
        ) : null}
        <Button
          type="submit"
          largura="cheia"
          carregando={pendente}
          disabled={codigo.length !== 6}
          motivoDesabilitado="Digite os 6 números do código que chegou no WhatsApp."
        >
          Entrar
        </Button>
        {saidaParaEmail}
        <Button
          type="button"
          variante="ghost"
          largura="cheia"
          disabled={espera > 0 || pendente}
          motivoDesabilitado="Espere a contagem acabar para pedir outro código."
          onClick={() => void pedirCodigo()}
        >
          {espera > 0 ? `Mandar de novo em ${espera} s` : 'Mandar o código de novo'}
        </Button>
        <Button
          type="button"
          variante="ghost"
          largura="cheia"
          onClick={() => {
            setEtapa('numero')
            setErro(null)
          }}
        >
          Trocar o número
        </Button>
      </form>
    )
  }

  return (
    <form
      method="post"
      onSubmit={(e) => {
        e.preventDefault()
        void pedirCodigo()
      }}
      className="flex w-full max-w-sm flex-col gap-3"
    >
      <Input rotulo="Seu nome" name="nome" autoComplete="name" required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} />
      <Input
        rotulo="Seu WhatsApp"
        name="telefone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(11) 99999-9999"
        required
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
        ajuda="Vamos mandar um código por lá. Neste aparelho, você só faz isso uma vez."
      />
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      <Button type="submit" largura="cheia" carregando={pendente}>
        Mandar código
      </Button>
      {saidaParaEmail}
    </form>
  )
}
