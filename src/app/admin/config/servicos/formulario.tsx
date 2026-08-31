'use client'

import { useState, useTransition } from 'react'

import { urlDaVitrine } from '@/core/text/vitrine'
import { dinheiro } from '@/lib/formato'
import UploadDeFoto from '@/components/config/upload-de-foto'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import MoneyInput from '@/components/ui/money-input'
import Select from '@/components/ui/select'
import Sheet from '@/components/ui/sheet'
import Textarea from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

export type ServicoEditavel = {
  id: string
  name: string
  description: string | null
  duration_min: number
  price_cents: number
  pricing_model: string
  hourly_rate_cents: number | null
  half_day_price_cents: number | null
  cycle_days: number
  buffer_before_min: number
  buffer_after_min: number
  bookable_online: boolean
  /** Percentual do sinal em basis points — 3000 = 30%. */
  deposit_bps: number
  /** Chave da foto no bucket `vitrine`. Escrita só pela rota de upload. */
  image_key: string | null
}

type ModeloDePreco = 'fixed' | 'hourly' | 'visit_hourly' | 'daily'

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
  const [modeloDePreco, setModeloDePreco] = useState<ModeloDePreco>((servico?.pricing_model as ModeloDePreco) ?? 'fixed')
  const [valorHoraCentavos, setValorHoraCentavos] = useState(servico?.hourly_rate_cents ?? 0)
  const [meiaDiariaCentavos, setMeiaDiariaCentavos] = useState(servico?.half_day_price_cents ?? 0)
  const [temMeiaDiaria, setTemMeiaDiaria] = useState(servico?.half_day_price_cents != null)
  const [cicloDias, setCicloDias] = useState(String(servico?.cycle_days ?? 21))
  const [preparoAntes, setPreparoAntes] = useState(String(servico?.buffer_before_min ?? 0))
  const [preparoDepois, setPreparoDepois] = useState(String(servico?.buffer_after_min ?? 0))
  const [apareceNoSite, setApareceNoSite] = useState(servico?.bookable_online ?? true)
  /*
    O sinal existia na API e no banco desde a 0001, e a lista já mostrava o selo "Sinal X%" — mas
    não havia onde definir. Guardado em pontos percentuais aqui e convertido para basis points no
    envio: o dono pensa em "30%", o banco guarda 3000 (regra 3 do CLAUDE.md).
  */
  const [sinalPercentual, setSinalPercentual] = useState(String((servico?.deposit_bps ?? 0) / 100))
  const [erro, setErro] = useState<string | null>(null)

  const editando = !!servico

  function enviar(formData: FormData) {
    setErro(null)

    const corpo = {
      name: String(formData.get('nome') ?? nome).trim(),
      description: descricao.trim() || null,
      durationMin: Number(duracao),
      priceCents: precoCentavos,
      pricingModel: modeloDePreco,
      hourlyRateCents: modeloDePreco === 'visit_hourly' ? valorHoraCentavos : null,
      halfDayPriceCents: modeloDePreco === 'daily' && temMeiaDiaria ? meiaDiariaCentavos : null,
      cycleDays: Number(cicloDias),
      bufferBeforeMin: Number(preparoAntes),
      bufferAfterMin: Number(preparoDepois),
      bookableOnline: apareceNoSite,
      // Percentual → basis points. `Math.round` porque o campo aceita decimal (12,5%).
      depositBps: Math.round(Number(sinalPercentual.replace(',', '.') || 0) * 100),
    }

    iniciarTransicao(async () => {
      try {
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
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
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
          <MoneyInput
            rotulo={modeloDePreco === 'hourly' ? 'Preço por hora' : modeloDePreco === 'visit_hourly' ? 'Taxa de visita' : modeloDePreco === 'daily' ? 'Diária' : 'Preço'}
            centavos={precoCentavos}
            aoMudar={setPrecoCentavos}
            required
          />
        </div>

        <Select
          rotulo="Como cobra"
          value={modeloDePreco}
          onChange={(e) => setModeloDePreco(e.target.value as ModeloDePreco)}
          ajuda="Muda só como o preço aparece pro cliente — o valor que entra no caixa continua ajustável na hora de fechar."
        >
          <option value="fixed">Preço fechado</option>
          <option value="hourly">Por hora</option>
          <option value="visit_hourly">Taxa de visita + hora</option>
          <option value="daily">Diária</option>
        </Select>

        {modeloDePreco === 'visit_hourly' ? (
          <MoneyInput rotulo="Valor da hora (depois da visita)" centavos={valorHoraCentavos} aoMudar={setValorHoraCentavos} required />
        ) : null}

        {modeloDePreco === 'daily' ? (
          <>
            <label className="flex min-h-12 items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={temMeiaDiaria}
                onChange={(e) => setTemMeiaDiaria(e.target.checked)}
                className="size-5 shrink-0 accent-[var(--acc-2)]"
              />
              <span className="text-corpo text-txt">Também cobra meia diária</span>
            </label>
            {temMeiaDiaria ? <MoneyInput rotulo="Meia diária" centavos={meiaDiariaCentavos} aoMudar={setMeiaDiariaCentavos} required /> : null}
          </>
        ) : null}

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

        {/*
          Só ao editar: a foto precisa de um `id` para ser vinculada, e no cadastro a linha ainda
          não existe. O componente diz isso em vez de aparecer quebrado.
        */}
        <div className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Foto do serviço</span>
          <UploadDeFoto tipo="service" id={servico?.id ?? null} urlAtual={urlDaVitrine(servico?.image_key ?? null)} />
        </div>

        <Input
          rotulo="Sinal (%)"
          name="sinal"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.5"
          value={sinalPercentual}
          onChange={(e) => setSinalPercentual(e.target.value)}
          classNameCampo="tabular"
          ajuda={
            precoCentavos > 0 && Number(sinalPercentual.replace(',', '.')) > 0
              ? `A cliente vê "sinal de ${dinheiro.format((precoCentavos * Number(sinalPercentual.replace(',', '.'))) / 10000)}" antes de confirmar. Você combina o pagamento com ela — o CICLO não cobra.`
              : 'Deixe 0 se não pede sinal. O valor aparece para a cliente antes dela confirmar o horário.'
          }
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
