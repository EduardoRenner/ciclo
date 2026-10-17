'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'

/**
 * APR-023. `aceitar`: chama `memberships/accept` e vai para a Hoje do negócio que chamou (a rota
 * grava esse negócio como o ativo). `trocar-de-conta`: sai da conta atual e volta ao login com este
 * convite como destino — o convite é travado no e-mail, e explicar sem oferecer a saída deixava a
 * pessoa sem caminho.
 */
export default function AceitarConvite({ token, modo, voltarPara }: { token: string; modo: 'aceitar' | 'trocar-de-conta'; voltarPara: string }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()

  function aceitar() {
    setErro(null)
    iniciar(async () => {
      try {
        const r = await fetch('/api/v1/memberships/accept', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const json = (await r.json()) as { error?: { message?: string } }
        if (!r.ok) {
          setErro(json.error?.message ?? 'Não consegui aceitar o convite. Tente de novo.')
          return
        }
        router.replace('/admin/hoje')
        router.refresh()
      } catch {
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  function trocarDeConta() {
    setErro(null)
    iniciar(async () => {
      try {
        const r = await fetch('/api/v1/auth/logout', { method: 'POST' })
        if (!r.ok) throw new Error('logout')
        router.replace(`/entrar?${new URLSearchParams({ proximo: voltarPara }).toString()}`)
        router.refresh()
      } catch {
        setErro('Não consegui sair agora. Confira a conexão e tente de novo.')
      }
    })
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {modo === 'aceitar' ? (
        <Button onClick={aceitar} carregando={enviando}>
          Aceitar e entrar na equipe
        </Button>
      ) : (
        <Button variante="secondary" onClick={trocarDeConta} carregando={enviando}>
          Sair e entrar com o e-mail do convite
        </Button>
      )}
      <p role="alert" className="min-h-5 text-secundario text-bad">
        {erro}
      </p>
    </div>
  )
}
