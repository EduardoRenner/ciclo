'use client'

import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import MoneyInput from '@/components/ui/money-input'
import Sheet from '@/components/ui/sheet'
import Textarea from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

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
  // Centavos direto no estado: com o `MoneyInput` não existe mais estado
  // intermediário inválido ("35," pela metade) para validar depois.
  const [precoCentavos, setPrecoCentavos] = useState(servico?.price_cents ?? 0)
  const [cicloDias, setCicloDias] = useState(String(servico?.cycle_days ?? 21))
  const [preparoAntes, setPreparoAntes] = useState(String(servico?.buffer_before_min ?? 0))
  const [preparoDepois, setPreparoDepois] = useState(String(servico?.buffer_after_min ?? 0))
  const [apareceNoSite, setApareceNoSite] = useState(servico?.bookable_online ?? true)
  const [erro, setErro] = useState<string | null>(null)

  const editando = !!servico

  function enviar(formData: FormData) {
    setErro(null)

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
        <Input rotulo="Nome" name="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />

        <Textarea
          rotulo="Descrição (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            rotulo="Duração (min)"
            type="number"
            inputMode="numeric"
            min={5}
            max={720}
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            required
            classNameCampo="tabular"
          />
          <MoneyInput rotulo="Preço" centavos={precoCentavos} aoMudar={setPrecoCentavos} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            rotulo="Preparo antes (min)"
            type="number"
            inputMode="numeric"
            min={0}
            max={240}
            value={preparoAntes}
            onChange={(e) => setPreparoAntes(e.target.value)}
            classNameCampo="tabular"
          />
          <Input
            rotulo="Limpeza depois (min)"
            type="number"
            inputMode="numeric"
            min={0}
            max={240}
            value={preparoDepois}
            onChange={(e) => setPreparoDepois(e.target.value)}
            classNameCampo="tabular"
          />
        </div>

        <Input
          rotulo="Volta em quantos dias, em média"
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          value={cicloDias}
          onChange={(e) => setCicloDias(e.target.value)}
          classNameCampo="tabular"
          ajuda="É o que o Motor de Ciclo usa até aprender o ritmo de cada cliente."
        />

        <label className="flex min-h-12 items-center gap-3 py-1">
          <input
            type="checkbox"
            checked={apareceNoSite}
            onChange={(e) => setApareceNoSite(e.target.checked)}
            className="size-5 shrink-0 accent-[var(--acc-2)]"
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
