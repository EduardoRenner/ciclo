'use client'

import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

type Fator = { id: string; status: string; createdAt: string }
type Cadastro = { factorId: string; qrCode: string; secret: string }

/**
 * docs/09-PLATAFORMA.md §19 (achado em V2): `exigirAal2()` já trava exportar dado, apagar
 * cliente (LGPD) e o cofre de saúde — mas até aqui não existia tela nenhuma pra cadastrar o
 * segundo fator, então essas três rotas eram inacessíveis pra sempre. TOTP nativo do Supabase
 * Auth — sem tabela nova, sem segredo próprio pra guardar.
 */
export default function FormularioSeguranca({ fatoresIniciais }: { fatoresIniciais: Fator[] }) {
  const mostrarToast = useToast()
  const [fatores, setFatores] = useState(fatoresIniciais)
  const [cadastro, setCadastro] = useState<Cadastro | null>(null)
  const [codigo, setCodigo] = useState('')
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const ativo = fatores.find((f) => f.status === 'verified')

  async function iniciarCadastro() {
    setErro(null)
    setPendente(true)
    try {
      const r = await fetch('/api/v1/auth/mfa/enroll', { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() } })
      const json = (await r.json()) as { data?: Cadastro; error?: { message: string } }
      if (!r.ok || !json.data) {
        setErro(json.error?.message ?? 'Não consegui gerar o QR code.')
        return
      }
      setCadastro(json.data)
    } finally {
      setPendente(false)
    }
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault()
    if (!cadastro) return
    setErro(null)
    setPendente(true)
    try {
      const r = await fetch('/api/v1/auth/mfa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ factorId: cadastro.factorId, code: codigo }),
      })
      const json = (await r.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
      if (!r.ok) {
        const primeiroCampo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(primeiroCampo ?? json.error?.message ?? 'Código incorreto.')
        return
      }
      setFatores((atual) => [...atual, { id: cadastro.factorId, status: 'verified', createdAt: new Date().toISOString() }])
      setCadastro(null)
      setCodigo('')
      mostrarToast({ tom: 'ok', titulo: 'Autenticação em duas etapas ativada' })
    } finally {
      setPendente(false)
    }
  }

  async function remover(factorId: string) {
    setErro(null)
    setPendente(true)
    try {
      const r = await fetch(`/api/v1/auth/mfa/factors/${factorId}`, { method: 'DELETE', headers: { 'idempotency-key': crypto.randomUUID() } })
      const json = (await r.json()) as { error?: { code: string; message: string } }
      if (!r.ok) {
        // MFA_REQUIRED aqui significa: a sessão atual só provou a senha, não o segundo fator
        // ainda (ex.: quem cadastrou numa aba e voltou nesta sem ter passado pelo desafio).
        setErro(
          json.error?.code === 'MFA_REQUIRED'
            ? 'Saia e entre de novo confirmando o código do app pra poder remover.'
            : (json.error?.message ?? 'Não consegui remover.'),
        )
        return
      }
      setFatores((atual) => atual.filter((f) => f.id !== factorId))
      mostrarToast({ tom: 'ok', titulo: 'Autenticação em duas etapas desativada' })
    } finally {
      setPendente(false)
    }
  }

  if (cadastro) {
    return (
      <Card className="flex flex-col items-center gap-4 text-center">
        <p className="text-corpo text-txt-2">Escaneie com o app autenticador (Google Authenticator, Authy…)</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI do Supabase, sem otimização de imagem faz sentido aqui */}
        <img src={cadastro.qrCode} alt="QR code para configurar o autenticador" className="size-48 rounded-[var(--radius-sm)] bg-white p-2" />
        <p className="text-secundario text-txt-3">
          Não consegue escanear? Digite manualmente: <span className="tabular font-semibold text-txt">{cadastro.secret}</span>
        </p>
        <form onSubmit={confirmarCodigo} className="flex w-full max-w-xs flex-col gap-3">
          <Input
            rotulo="Código de 6 dígitos"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            classNameCampo="tabular text-center text-titulo tracking-[0.3em]"
            required
          />
          {erro ? (
            <p role="alert" className="text-secundario text-bad">
              {erro}
            </p>
          ) : null}
          <Button type="submit" largura="cheia" carregando={pendente} disabled={codigo.length !== 6}>
            Confirmar e ativar
          </Button>
          <Button type="button" variante="secondary" largura="cheia" onClick={() => setCadastro(null)} disabled={pendente}>
            Cancelar
          </Button>
        </form>
      </Card>
    )
  }

  if (ativo) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-acc-soft text-acc-2">
            <ShieldCheck aria-hidden className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-corpo font-semibold">Autenticação em duas etapas ativada</p>
            <p className="text-secundario text-txt-2">Sua conta pede o código do app a cada novo login.</p>
          </div>
        </div>
        {erro ? (
          <p role="alert" className="text-secundario text-bad">
            {erro}
          </p>
        ) : null}
        <Button variante="secondary" largura="cheia" carregando={pendente} onClick={() => remover(ativo.id)}>
          Desativar
        </Button>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-corpo text-txt-2">
        Sem a autenticação em duas etapas, exportar dados, apagar cliente e abrir o cofre de saúde continuam bloqueados por segurança —
        ative pra liberar esses recursos.
      </p>
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      <Button largura="cheia" carregando={pendente} onClick={iniciarCadastro}>
        Ativar autenticação em duas etapas
      </Button>
    </Card>
  )
}
