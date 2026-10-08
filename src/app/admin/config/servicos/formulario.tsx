'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import type { ModeloDePreco } from '@/core/pricing/formatar'
import { dinheiro } from '@/lib/formato'
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
  // Calculado do que o serviço JÁ tinha ao abrir, não do que a pessoa digita: o painel não pode
  // fechar sozinho no meio da digitação.
  const [temOpcaoNaoPadrao] = useState(
    !!servico &&
      (servico.pricing_model !== 'fixed' ||
        servico.deposit_bps > 0 ||
        servico.buffer_before_min > 0 ||
        servico.buffer_after_min > 0 ||
        !servico.bookable_online ||
        !!servico.description),
  )

  function enviar(formData: FormData) {
    /*
     * `MoneyInput` nunca fica vazio de verdade (sempre mostra "0,00" formatado), então o
     * `required` da prop nunca dispara — quem troca o modelo de preço e esquece de digitar um
     * valor salvava o serviço a R$ 0,00, cobrável de graça em toda reserva futura. O schema do
     * servidor só exige presença (`!= null`), não valor positivo — zero é `int().min(0)`, válido
     * pro tipo — então a trava real precisa estar aqui, do mesmo jeito que os outros formulários
     * desta base já travam o que o `required` do HTML não alcança.
     */
    if (modeloDePreco !== 'quote' && precoCentavos <= 0) {
      setErro('Defina um preço maior que zero.')
      return
    }
    if (modeloDePreco === 'visit_hourly' && valorHoraCentavos <= 0) {
      setErro('Defina um valor da hora maior que zero.')
      return
    }
    if (modeloDePreco === 'daily' && temMeiaDiaria && meiaDiariaCentavos <= 0) {
      setErro('Defina um valor de meia diária maior que zero, ou desmarque "Também cobra meia diária".')
      return
    }
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
      <form method="post" action={enviar} className="flex flex-col gap-3">
        <Input rotulo="Nome" name="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />

        <div className={modeloDePreco === 'quote' ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
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
          {/*
            Sob orçamento não tem campo de preço, e o motivo é o `required`: deixar o campo na tela
            faria a pessoa preencher um número inventado para o formulário aceitar. É a mesma classe
            de "a tela deixa trabalhar para recusar no envio" já corrigida em outras telas daqui.
            A duração continua, porque ela reserva o horário mesmo sem valor fechado.
          */}
          {modeloDePreco === 'quote' ? null : (
            <MoneyInput
              rotulo={modeloDePreco === 'hourly' ? 'Preço por hora' : modeloDePreco === 'visit_hourly' ? 'Taxa de visita' : modeloDePreco === 'daily' ? 'Diária' : 'Preço'}
              centavos={precoCentavos}
              aoMudar={setPrecoCentavos}
              required
            />
          )}
        </div>

        {/*
          O cadastro é nome, tempo e preço. O resto continua existindo, com o padrão de sempre, mas
          fechado: quem cadastra o primeiro serviço não precisa decidir sinal, limpeza ou ciclo
          para terminar. Aberto de saída quando o serviço já usa algum deles (editar um serviço
          com sinal e esconder o sinal faria a pessoa achar que ele sumiu), e quando o modelo de
          preço não é o fechado, porque aí o campo extra do modelo é parte do preço.

          A foto do serviço saiu daqui: o cadastro mostra o que é, quanto custa e quanto dura.
        */}
        <details className="rounded-[var(--radius-sm)] border border-line-2 px-3" open={temOpcaoNaoPadrao}>
          <summary className="flex min-h-12 cursor-pointer items-center text-corpo font-semibold text-txt-2">Mais opções</summary>
          <div className="flex flex-col gap-3 pb-3">
            <Textarea rotulo="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />

            <Select rotulo="Como cobra" value={modeloDePreco} onChange={(e) => setModeloDePreco(e.target.value as ModeloDePreco)}>
              <option value="fixed">Preço fechado</option>
              <option value="hourly">Por hora</option>
              <option value="visit_hourly">Taxa de visita + hora</option>
              <option value="daily">Diária</option>
              <option value="quote">Sob orçamento</option>
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
            />

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
                  ? `Quem agenda vê "sinal de ${dinheiro.format((precoCentavos * Number(sinalPercentual.replace(',', '.'))) / 10000)}" antes de confirmar. Você combina o pagamento direto. O CICLO não cobra.`
                  : undefined
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

            {/*
              A ficha de consumo (o que o serviço gasta de produto) saiu da lista, onde aparecia em
              TODA linha, e mora aqui: é o que dá o custo do serviço e baixa o estoque no fechamento
              da comanda, então continua alcançável, só não disputa a tela de quem cadastra.
            */}
            {editando ? (
              <Link href={`/admin/config/servicos/${servico.id}/ficha`} className="flex min-h-12 items-center text-label font-semibold text-acc-2">
                Produtos que este serviço gasta
              </Link>
            ) : null}
          </div>
        </details>

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
