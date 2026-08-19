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
import { dinheiro, formatarTelefone } from '@/lib/formato'
import { apiFetch } from '@/lib/offline/api-client'

type Servico = { id: string; name: string; duration_min: number; price_cents: number }
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

  /**
   * "Marcar horário" na ficha manda `?cliente=<id>` e o nome/telefone vêm daqui. Só o id viaja
   * na URL, nunca nome nem telefone: dado pessoal não entra em query string (fica em histórico
   * de navegador, log de servidor e Referer). Sem isto o botão da ficha abria o formulário em
   * branco e a pessoa tinha que redigitar quem já estava na tela anterior.
   */
  const clienteId = useSearchParams().get('cliente')
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
        mostrarToast({ tom: 'ok', titulo: 'Prontinho', descricao: 'Agendamento criado.' })
        router.push('/admin/agenda')
        return
      }

      if (json.error?.code === 'SLOT_TAKEN') {
        setAlternativas(json.error.details?.alternatives ?? [])
        setErro(json.error.message)
        return
      }

      setErro(json.error?.message ?? 'Não consegui criar o agendamento.')
    })
  }

  function aoEnviarFormulario(e: React.FormEvent) {
    e.preventDefault()
    if (!dataHora) return
    enviar(paraIso(dataHora))
  }

  return (
    <form onSubmit={aoEnviarFormulario} className="flex flex-col gap-4">
      <Select rotulo="Serviço" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
        {servicos.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {dinheiro.format(s.price_cents / 100)}
          </option>
        ))}
      </Select>

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

      <Button type="submit" largura="cheia" carregando={pendente} disabled={servicos.length === 0 || profissionais.length === 0}>
        Confirmar agendamento
      </Button>
    </form>
  )
}
