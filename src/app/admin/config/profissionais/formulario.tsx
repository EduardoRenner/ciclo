'use client'

import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'

export type ProfissionalEditavel = {
  id: string
  display_name: string
  bio: string | null
  color: string | null
  accepts_online: boolean
}

type Props = {
  aberto: boolean
  aoFechar: () => void
  profissional?: ProfissionalEditavel | null
  aoSalvar: (profissional: ProfissionalEditavel) => void
}

const CORES = ['#a855f7', '#ec4899', '#f59e0b', '#10b981', '#60a5fa', '#f87171']

/**
 * Cadastro de profissional sem convite/login — o "profissional que não usa o
 * app" que o `EmptyState` já mencionava sem ter como fazer. Modelo de
 * comissão fica fora do formulário de propósito (mexe em cálculo de
 * comissão de verdade); a API já tem `default('owner')`/`default(0)`, então
 * omitir os campos aqui não quebra nada.
 */
export default function FormularioProfissional({ aberto, aoFechar, profissional, aoSalvar }: Props) {
  const mostrarToast = useToast()
  const [pendente, iniciarTransicao] = useTransition()

  const [nome, setNome] = useState(profissional?.display_name ?? '')
  const [bio, setBio] = useState(profissional?.bio ?? '')
  const [cor, setCor] = useState(profissional?.color ?? CORES[0]!)
  const [aceitaOnline, setAceitaOnline] = useState(profissional?.accepts_online ?? true)
  const [erro, setErro] = useState<string | null>(null)

  const editando = !!profissional

  function enviar() {
    setErro(null)
    const corpo = { displayName: nome.trim(), bio: bio.trim() || null, color: cor, acceptsOnline: aceitaOnline }

    iniciarTransicao(async () => {
      const url = editando ? `/api/v1/professionals/${profissional.id}` : '/api/v1/professionals'
      const r = await fetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify(corpo),
      })
      const json = (await r.json()) as {
        data?: ProfissionalEditavel
        error?: { message: string; details?: { fields?: Record<string, string> } }
      }
      if (!r.ok || !json.data) {
        const primeiroCampo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(primeiroCampo ?? json.error?.message ?? 'Não consegui salvar.')
        return
      }

      mostrarToast({ tom: 'ok', titulo: editando ? 'Profissional atualizado' : 'Profissional cadastrado' })
      aoSalvar(json.data)
      aoFechar()
    })
  }

  return (
    <Sheet aberto={aberto} aoFechar={(a) => !a && aoFechar()} titulo={editando ? 'Editar profissional' : 'Novo profissional'}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Bio (opcional)</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 py-2 text-corpo text-txt"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Cor na agenda</span>
          <div className="flex gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                aria-pressed={cor === c}
                onClick={() => setCor(c)}
                className="size-9 rounded-[var(--radius-pill)] transition"
                style={{ backgroundColor: c, outline: cor === c ? `2px solid var(--txt)` : undefined, outlineOffset: 2 }}
              />
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={aceitaOnline}
            onChange={(e) => setAceitaOnline(e.target.checked)}
            className="size-5 rounded border-line-2 bg-surface-2"
          />
          <span className="text-corpo text-txt">Aceita agendamento pelo site</span>
        </label>

        {erro ? (
          <p role="alert" className="text-secundario text-bad">
            {erro}
          </p>
        ) : null}

        <Button type="button" largura="cheia" carregando={pendente} onClick={enviar} disabled={!nome.trim()}>
          {editando ? 'Salvar alterações' : 'Cadastrar profissional'}
        </Button>
      </div>
    </Sheet>
  )
}
