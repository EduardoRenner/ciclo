'use client'

import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { centavosParaReais, paraReaisCentavos } from '@/lib/formato'

export type ServicoEditavel = {
  id: string
  name: string
  description: string | null
  duration_min: number
  price_cents: number
  cycle_days: number
  buffer_before_min: number
  buffer_after_min: number
  bookable_online: boolean
}

type Props = {
  aberto: boolean
  aoFechar: () => void
  servico?: ServicoEditavel | null
  aoSalvar: (servico: ServicoEditavel) => void
}

/**
 * Um Sheet só para criar e editar (TICKET-045-ish, mas sem ticket próprio —
 * era um botão sem `onClick`, achado na auditoria pré-`/admin`). Mostra só o
 * que um cadastro básico precisa; sinal/capacidade paralela/anamnese/
 * categoria continuam existindo na API, com o padrão que já tinham, sem UI
 * ainda — decisão registrada em `docs/DECISOES.md`.
 */
export default function FormularioServico({ aberto, aoFechar, servico, aoSalvar }: Props) {
  const mostrarToast = useToast()
  const [pendente, iniciarTransicao] = useTransition()

  const [nome, setNome] = useState(servico?.name ?? '')
  const [descricao, setDescricao] = useState(servico?.description ?? '')
  const [duracao, setDuracao] = useState(String(servico?.duration_min ?? 30))
  const [preco, setPreco] = useState(servico ? centavosParaReais(servico.price_cents) : '')
  const [cicloDias, setCicloDias] = useState(String(servico?.cycle_days ?? 21))
  const [preparoAntes, setPreparoAntes] = useState(String(servico?.buffer_before_min ?? 0))
  const [preparoDepois, setPreparoDepois] = useState(String(servico?.buffer_after_min ?? 0))
  const [apareceNoSite, setApareceNoSite] = useState(servico?.bookable_online ?? true)
  const [erro, setErro] = useState<string | null>(null)

  const editando = !!servico

  function enviar(formData: FormData) {
    setErro(null)
    const precoCentavos = paraReaisCentavos(preco)
    if (precoCentavos === null) {
      setErro('Digite um preço válido, como 35,90.')
      return
    }

    const corpo = {
      name: String(formData.get('nome') ?? nome).trim(),
      description: descricao.trim() || null,
      durationMin: Number(duracao),
      priceCents: precoCentavos,
      cycleDays: Number(cicloDias),
      bufferBeforeMin: Number(preparoAntes),
      bufferAfterMin: Number(preparoDepois),
      bookableOnline: apareceNoSite,
    }

    iniciarTransicao(async () => {
      const url = editando ? `/api/v1/services/${servico.id}` : '/api/v1/services'
      const r = await fetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify(corpo),
      })
      const json = (await r.json()) as { data?: ServicoEditavel; error?: { message: string; details?: { fields?: Record<string, string> } } }
      if (!r.ok || !json.data) {
        const primeiroCampo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(primeiroCampo ?? json.error?.message ?? 'Não consegui salvar o serviço.')
        return
      }

      mostrarToast({ tom: 'ok', titulo: editando ? 'Serviço atualizado' : 'Serviço cadastrado' })
      aoSalvar(json.data)
      aoFechar()
    })
  }

  return (
    <Sheet aberto={aberto} aoFechar={(a) => !a && aoFechar()} titulo={editando ? 'Editar serviço' : 'Novo serviço'}>
      <form action={enviar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Nome</span>
          <input
            name="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Descrição (opcional)</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 py-2 text-corpo text-txt"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Duração (min)</span>
            <input
              type="number"
              inputMode="numeric"
              min={5}
              max={720}
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              required
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Preço (R$)</span>
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              required
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Preparo antes (min)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={240}
              value={preparoAntes}
              onChange={(e) => setPreparoAntes(e.target.value)}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Limpeza depois (min)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={240}
              value={preparoDepois}
              onChange={(e) => setPreparoDepois(e.target.value)}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Volta em quantos dias, em média</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={cicloDias}
            onChange={(e) => setCicloDias(e.target.value)}
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
          />
        </label>
        <label className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={apareceNoSite}
            onChange={(e) => setApareceNoSite(e.target.checked)}
            className="size-5 rounded border-line-2 bg-surface-2"
          />
          <span className="text-corpo text-txt">Aparece no site para agendamento online</span>
        </label>

        {erro ? (
          <p role="alert" className="text-secundario text-bad">
            {erro}
          </p>
        ) : null}

        <Button type="submit" largura="cheia" carregando={pendente}>
          {editando ? 'Salvar alterações' : 'Cadastrar serviço'}
        </Button>
      </form>
    </Sheet>
  )
}
