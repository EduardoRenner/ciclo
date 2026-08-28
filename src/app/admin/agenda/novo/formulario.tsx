'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'
import Input from '@/components/ui/input'
import PhoneInput from '@/components/ui/phone-input'
import Select from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { formatarPreco } from '@/core/pricing/formatar'
import { formatarTelefone } from '@/lib/formato'
import { apiFetch } from '@/lib/offline/api-client'

type Servico = {
  id: string
  name: string
  duration_min: number
  price_cents: number
  pricing_model: string
  hourly_rate_cents: number | null
  half_day_price_cents: number | null
}
type Profissional = { id: string; display_name: string }

function paraIso(dataLocal: string): string {
  return new Date(dataLocal).toISOString()
}

function formatarAlternativa(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function FormularioAgendamento({
  servicos,
  profissionais,
}: {
  servicos: Servico[]
  profissionais: Profissional[]
}) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [pendente, iniciarTransicao] = useTransition()

  const [serviceId, setServiceId] = useState(servicos[0]?.id ?? '')
  const [professionalId, setProfessionalId] = useState(profissionais[0]?.id ?? '')
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [dataHora, setDataHora] = useState('')
  const [alternativas, setAlternativas] = useState<string[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // docs/09-PLATAFORMA.md §12: série de recorrência é um agendamento a mais que se repete,
  // não uma tela separada — por isso vive dentro do mesmo formulário, atrás de um toggle.
  const [repetir, setRepetir] = useState(false)
  const [tipoRecorrencia, setTipoRecorrencia] = useState<'semanal' | 'a_cada_dias' | 'mensal_dia_semana'>('semanal')
  const [intervaloSemanas, setIntervaloSemanas] = useState('1')
  const [intervaloDias, setIntervaloDias] = useState('30')
  const [ordinalNoMes, setOrdinalNoMes] = useState('1')
  const [fimTipo, setFimTipo] = useState<'sem_fim' | 'ate_data' | 'numero_de_vezes'>('numero_de_vezes')
  const [fimData, setFimData] = useState('')
  const [fimNumero, setFimNumero] = useState('8')

  /**
   * "Marcar horário" na ficha manda `?cliente=<id>` e o nome/telefone vêm daqui. Só o id viaja
   * na URL, nunca nome nem telefone: dado pessoal não entra em query string (fica em histórico
   * de navegador, log de servidor e Referer). Sem isto o botão da ficha abria o formulário em
   * branco e a pessoa tinha que redigitar quem já estava na tela anterior.
   */
  const searchParams = useSearchParams()
  const clienteId = searchParams.get('cliente')
  // "Marcar horário" na lista de orçamentos aprovados manda `?orcamento=<id>` além do `cliente`
  // — depois que o agendamento é criado, registra o vínculo em `quotes.converted_appointment_id`
  // (reservado desde P8, nunca lido). Não escolhe serviço/preço a partir do orçamento: os itens
  // são texto livre, sem `service_id` por trás, então quem decide isso continua sendo o
  // profissional aqui na tela normal — ver `converterOrcamentoEmAgendamento` em orcamentos.ts.
  const orcamentoId = searchParams.get('orcamento')
  useEffect(() => {
    if (!clienteId) return
    let cancelado = false
    fetch(`/api/v1/clients/${clienteId}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ data?: { name: string; phone_e164: string | null } }>) : null))
      .then((json) => {
        if (cancelado || !json?.data) return
        setClienteNome(json.data.name)
        // `+5511991110001` é o formato do banco, não o que a pessoa lê — mostra como ela digitaria.
        setClienteTelefone(formatarTelefone(json.data.phone_e164) ?? '')
      })
      .catch(() => {
        // Falhar aqui só significa formulário em branco — o cadastro manual continua valendo.
      })
    return () => {
      cancelado = true
    }
  }, [clienteId])

  function enviar(startsAtIso: string) {
    setErro(null)
    setAlternativas(null)

    const corpo = {
      clientDraft: { name: clienteNome, phone: clienteTelefone },
      serviceId,
      professionalId,
      startsAt: startsAtIso,
      origin: 'app',
    }

    iniciarTransicao(async () => {
      // §4.2: sem rede, não dá pra saber se o horário ainda está livre nem
      // pra mostrar alternativas de `SLOT_TAKEN` — a única coisa correta é
      // enfileirar e revalidar quando a mutação sair da fila de verdade. O
      // servidor é quem decide se o horário oferecido offline ainda existe.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await apiFetch('/api/v1/appointments', { method: 'POST', body: corpo })
        mostrarToast({ tom: 'ok', titulo: 'Sem conexão', descricao: 'Agendamento entrou na fila e será enviado quando a conexão voltar.' })
        router.push('/admin/agenda')
        return
      }

      try {
        const r = await fetch('/api/v1/appointments', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify(corpo),
        })
        const json = (await r.json()) as {
          data?: { appointment: { id: string } }
          error?: { code: string; message: string; details?: { alternatives?: string[] } }
        }

        if (r.ok && json.data) {
          if (orcamentoId) {
            // Best-effort: o agendamento já existe e é o que importa — se o vínculo falhar, a
            // cliente já tem hora marcada, só o orçamento não fica marcado como "virou agendamento"
            // (segue "Aprovado" na lista, sem perder nada; dá pra tentar nessa tela de novo depois).
            await fetch(`/api/v1/quotes/${orcamentoId}/convert`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
              body: JSON.stringify({ appointmentId: json.data.appointment.id }),
            }).catch(() => {})
          }
          mostrarToast({ tom: 'ok', titulo: 'Agendamento criado' })
          router.push('/admin/agenda')
          return
        }

        if (json.error?.code === 'SLOT_TAKEN') {
          setAlternativas(json.error.details?.alternatives ?? [])
          setErro(json.error.message)
          return
        }

        setErro(json.error?.message ?? 'Não consegui criar o agendamento.')
      } catch {
        // Rede caiu no meio da chamada — sem isto, o React 19 relança para o error boundary da
        // raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  function enviarSerie() {
    setErro(null)
    setAlternativas(null)

    const [startsOn, horario] = dataHora.split('T')
    const weekday = new Date(dataHora).getDay() // 0 = domingo, mesma convenção do banco

    const corpo = {
      clientDraft: { name: clienteNome, phone: clienteTelefone },
      serviceId,
      professionalId,
      tipo: tipoRecorrencia,
      weekday: tipoRecorrencia === 'a_cada_dias' ? null : weekday,
      intervaloSemanas: tipoRecorrencia === 'semanal' ? Number(intervaloSemanas) : null,
      intervaloDias: tipoRecorrencia === 'a_cada_dias' ? Number(intervaloDias) : null,
      ordinalNoMes: tipoRecorrencia === 'mensal_dia_semana' ? Number(ordinalNoMes) : null,
      horario,
      startsOn,
      endsOn: fimTipo === 'ate_data' ? fimData : null,
      maxOcorrencias: fimTipo === 'numero_de_vezes' ? Number(fimNumero) : null,
    }

    iniciarTransicao(async () => {
      try {
        const r = await fetch('/api/v1/appointments/series', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify(corpo),
        })
        const json = (await r.json()) as {
          data?: { occurrences: { status: string }[] }
          error?: { code: string; message: string }
        }

        if (r.ok && json.data) {
          const total = json.data.occurrences.length
          const puladas = json.data.occurrences.filter((o) => o.status !== 'agendada').length
          mostrarToast({
            tom: 'ok',
            titulo: 'Série criada',
            descricao:
              puladas > 0
                ? `${total - puladas} de ${total} horários marcados — ${puladas} pulados por folga ou conflito.`
                : `${total} horários marcados.`,
          })
          router.push('/admin/agenda')
          return
        }

        setErro(json.error?.message ?? 'Não consegui criar a série.')
      } catch {
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  function aoEnviarFormulario(e: React.FormEvent) {
    e.preventDefault()
    if (!dataHora) return
    if (repetir) {
      enviarSerie()
      return
    }
    enviar(paraIso(dataHora))
  }

  return (
    <form onSubmit={aoEnviarFormulario} className="flex flex-col gap-4">
      <Select rotulo="Serviço" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
        {servicos.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ·{' '}
            {formatarPreco({
              pricingModel: s.pricing_model as 'fixed' | 'hourly' | 'visit_hourly' | 'daily',
              priceCents: s.price_cents,
              hourlyRateCents: s.hourly_rate_cents,
              halfDayPriceCents: s.half_day_price_cents,
            })}
          </option>
        ))}
      </Select>

      {/*
        docs/09-PLATAFORMA.md §6 "modo solo": autônomo com 1 profissional
        (ele mesmo) não deveria escolher entre opções que não existem — o
        Select sempre mostraria uma linha só, e o estado já nasce nela
        (useState(profissionais[0]?.id)). Com 2+, a escolha continua.
      */}
      {profissionais.length > 1 ? (
        <Select
          rotulo="Profissional"
          value={professionalId}
          onChange={(e) => setProfessionalId(e.target.value)}
          required
        >
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </Select>
      ) : null}

      <Input
        rotulo="Cliente"
        value={clienteNome}
        onChange={(e) => setClienteNome(e.target.value)}
        placeholder="Nome"
        autoComplete="name"
        required
      />

      <PhoneInput valor={clienteTelefone} aoMudar={setClienteTelefone} required />

      <Input
        rotulo="Data e horário"
        type="datetime-local"
        value={dataHora}
        onChange={(e) => setDataHora(e.target.value)}
        required
        classNameCampo="tabular"
      />

      <label className="flex min-h-12 items-center gap-3 py-1">
        <input
          type="checkbox"
          checked={repetir}
          onChange={(e) => setRepetir(e.target.checked)}
          className="size-5 shrink-0 accent-[var(--acc-2)]"
        />
        <span className="text-corpo text-txt">Repetir este horário</span>
      </label>

      {repetir ? (
        <Card className="flex flex-col gap-3">
          <Select rotulo="Repete" value={tipoRecorrencia} onChange={(e) => setTipoRecorrencia(e.target.value as typeof tipoRecorrencia)}>
            <option value="semanal">Toda semana (no dia escolhido acima)</option>
            <option value="a_cada_dias">A cada X dias</option>
            <option value="mensal_dia_semana">Todo mês, na mesma posição do dia (ex.: 1ª segunda)</option>
          </Select>

          {tipoRecorrencia === 'semanal' ? (
            <Select rotulo="A cada quantas semanas" value={intervaloSemanas} onChange={(e) => setIntervaloSemanas(e.target.value)}>
              <option value="1">Toda semana</option>
              <option value="2">A cada 2 semanas</option>
              <option value="4">A cada 4 semanas</option>
            </Select>
          ) : null}

          {tipoRecorrencia === 'a_cada_dias' ? (
            <Input
              rotulo="Intervalo em dias"
              type="number"
              min={1}
              value={intervaloDias}
              onChange={(e) => setIntervaloDias(e.target.value)}
              classNameCampo="tabular"
            />
          ) : null}

          {tipoRecorrencia === 'mensal_dia_semana' ? (
            <Select rotulo="Qual ocorrência do mês" value={ordinalNoMes} onChange={(e) => setOrdinalNoMes(e.target.value)}>
              <option value="1">1ª do mês</option>
              <option value="2">2ª do mês</option>
              <option value="3">3ª do mês</option>
              <option value="4">4ª do mês</option>
              <option value="5">Última do mês</option>
            </Select>
          ) : null}

          <Select rotulo="Termina" value={fimTipo} onChange={(e) => setFimTipo(e.target.value as typeof fimTipo)}>
            <option value="numero_de_vezes">Depois de um número de vezes</option>
            <option value="ate_data">Numa data</option>
            <option value="sem_fim">Sem data para terminar</option>
          </Select>

          {fimTipo === 'numero_de_vezes' ? (
            <Input
              rotulo="Número de vezes"
              type="number"
              min={1}
              value={fimNumero}
              onChange={(e) => setFimNumero(e.target.value)}
              classNameCampo="tabular"
            />
          ) : null}

          {fimTipo === 'ate_data' ? (
            <Input rotulo="Última data" type="date" value={fimData} onChange={(e) => setFimData(e.target.value)} classNameCampo="tabular" />
          ) : null}
        </Card>
      ) : null}

      {erro ? (
        <Card className="border-bad/40">
          <p role="alert" className="text-corpo font-semibold text-bad">
            {erro}
          </p>
          {alternativas && alternativas.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {alternativas.map((a) => (
                <Chip key={a} onClick={() => enviar(a)}>
                  {formatarAlternativa(a)}
                </Chip>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Button
        type="submit"
        largura="cheia"
        carregando={pendente}
        disabled={servicos.length === 0 || profissionais.length === 0}
        motivoDesabilitado={
          servicos.length === 0
            ? 'Cadastre pelo menos um serviço em Configurações para poder agendar.'
            : 'Cadastre pelo menos um profissional em Configurações para poder agendar.'
        }
      >
        {repetir ? 'Criar série' : 'Confirmar agendamento'}
      </Button>
    </form>
  )
}
