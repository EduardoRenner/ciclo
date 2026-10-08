'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Badge from '@/components/ui/badge'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import Select from '@/components/ui/select'
import Textarea from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { escreverJuridico } from '@/lib/advocacia/escrever'

export type PrazoDaFicha = {
  id: string
  titulo: string
  tipo: string
  venceEm: string
  horario: string | null
  internoEm: string | null
  estado: string
  confirmado: boolean
}

const ROTULO: Record<string, string> = { fatal: 'Prazo fatal', interno: 'Prazo interno', audiencia: 'Audiência', contratual: 'Prazo contratual' }

const data = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })

/**
 * "Dia e hora no relógio do escritório" → instante UTC (regra 4 do CLAUDE.md: aritmética nunca em horário
 * local). Mede a diferença do fuso NAQUELE dia, então horário de verão, se voltar, sai certo.
 */
function instanteNoFuso(dia: string, hora: string, timeZone: string): string {
  const chute = new Date(`${dia}T${hora}:00Z`)
  const noFuso = new Date(chute.toLocaleString('en-US', { timeZone }))
  const noUtc = new Date(chute.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(chute.getTime() + (noUtc.getTime() - noFuso.getTime())).toISOString()
}

type Modo = { id: string; tipo: 'cumprir' | 'corrigir' } | null

/**
 * docs/101 T4: os prazos abertos do caso com as ações que a fila de Hoje pede. As regras são do banco
 * (0109): fatal não adia, mudar data exige motivo, cumprido de fatal exige nota; a frase dele chega aqui.
 */
export default function PrazosDoCaso({ prazos, hoje, clienteId, casoId, timezone }: { prazos: PrazoDaFicha[]; hoje: string; clienteId: string; casoId: string; timezone: string }) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [pendente, iniciar] = useTransition()
  const [modo, setModo] = useState<Modo>(null)
  const [nota, setNota] = useState('')
  const [novaData, setNovaData] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<{ onde: string; texto: string } | null>(null)
  const [criando, setCriando] = useState(false)
  const [novo, setNovo] = useState({ kind: 'interno', title: '', dueOn: '', internalDueOn: '', hora: '' })

  const abertos = prazos.filter((p) => p.estado === 'aberto')

  function agir(onde: string, url: string, metodo: 'POST' | 'PATCH', corpo: unknown, feito: string) {
    setErro(null)
    iniciar(async () => {
      const r = await escreverJuridico(url, { method: metodo, json: corpo })
      if (!r.ok) {
        if (r.tipo === 'conflito') router.refresh()
        return setErro({ onde, texto: r.texto })
      }
      mostrarToast({ tom: 'ok', titulo: feito })
      setModo(null)
      setNota('')
      setMotivo('')
      setCriando(false)
      router.refresh()
    })
  }

  function criar() {
    const dueAt = novo.kind === 'audiencia' && novo.hora && novo.dueOn ? instanteNoFuso(novo.dueOn, novo.hora, timezone) : undefined
    agir(
      'novo',
      '/api/v1/legal/deadlines',
      'POST',
      {
        clientId: clienteId,
        caseId: casoId,
        kind: novo.kind,
        title: novo.title,
        dueOn: novo.dueOn,
        ...(novo.internalDueOn ? { internalDueOn: novo.internalDueOn } : {}),
        ...(dueAt ? { dueAt } : {}),
      },
      'Prazo criado',
    )
  }

  return (
    <div className="flex flex-col gap-2" aria-busy={pendente}>
      {abertos.length === 0 ? <p className="text-secundario text-txt-2">Nenhum prazo aberto neste caso.</p> : null}
      <ul className="flex flex-col gap-2">
        {abertos.map((p) => {
          const atrasado = (p.internoEm ?? p.venceEm) < hoje
          return (
            <li key={p.id}>
              <Card className="flex flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-corpo">{p.titulo}</p>
                    <p className={`text-secundario ${atrasado ? 'text-bad' : 'text-txt-2'}`}>
                      {p.tipo === 'fatal' && p.internoEm ? `Fazer até ${data(p.internoEm)} · fatal ${data(p.venceEm)}` : data(p.venceEm)}
                      {p.horario ? ` às ${new Date(p.horario).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone })}` : ''}
                    </p>
                    {p.tipo === 'fatal' && !p.confirmado ? <p className="text-label text-warn">Sugestão a confirmar</p> : null}
                  </div>
                  <Badge estado={p.tipo === 'fatal' ? 'risk' : 'ciclo'} className="shrink-0 whitespace-nowrap">
                    {ROTULO[p.tipo] ?? 'Prazo'}
                  </Badge>
                </div>

                {modo?.id === p.id && modo.tipo === 'cumprir' ? (
                  <div className="flex flex-col gap-2">
                    <Textarea
                      rotulo={p.tipo === 'fatal' ? 'Protocolo ou nota (obrigatório no prazo fatal)' : 'Nota (opcional)'}
                      rows={2}
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      maxLength={1000}
                    />
                    <div className="flex gap-2">
                      <Button tamanho="sm" carregando={pendente} onClick={() => agir(p.id, `/api/v1/legal/deadlines/${p.id}/close`, 'POST', { status: 'cumprido', ...(nota ? { nota } : {}) }, 'Prazo cumprido')}>
                        Registrar como cumprido
                      </Button>
                      <Button tamanho="sm" variante="ghost" onClick={() => setModo(null)}>
                        Voltar
                      </Button>
                    </div>
                  </div>
                ) : modo?.id === p.id && modo.tipo === 'corrigir' ? (
                  <div className="flex flex-col gap-2">
                    <Input rotulo="Data certa" type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
                    {novaData === p.venceEm ? <p className="text-label text-txt-3">Essa já é a data do prazo: escolha a data certa.</p> : null}
                    <Textarea rotulo="Motivo da correção" ajuda="Fica no histórico do prazo." rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
                    <div className="flex gap-2">
                      <Button
                        tamanho="sm"
                        carregando={pendente}
                        disabled={!novaData || novaData === p.venceEm || motivo.trim().length < 5}
                        motivoDesabilitado={novaData === p.venceEm ? 'Essa já é a data do prazo: escolha a data certa.' : 'Escolha a data e escreva o motivo (pelo menos 5 letras).'}
                        onClick={() => agir(p.id, `/api/v1/legal/deadlines/${p.id}`, 'PATCH', { acao: 'corrigir', dueOn: novaData, motivo }, 'Data corrigida')}
                      >
                        Corrigir
                      </Button>
                      <Button tamanho="sm" variante="ghost" onClick={() => setModo(null)}>
                        Voltar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button tamanho="sm" variante="secondary" onClick={() => (setModo({ id: p.id, tipo: 'cumprir' }), setNota(''))}>
                      Cumpri
                    </Button>
                    <Button tamanho="sm" variante="ghost" onClick={() => (setModo({ id: p.id, tipo: 'corrigir' }), setNovaData(p.venceEm), setMotivo(''))}>
                      Corrigir data
                    </Button>
                    {p.tipo === 'fatal' && !p.confirmado ? (
                      <Button tamanho="sm" variante="secondary" onClick={() => agir(p.id, `/api/v1/legal/deadlines/${p.id}`, 'PATCH', { acao: 'confirmar' }, 'Prazo confirmado')}>
                        Confirmar
                      </Button>
                    ) : null}
                  </div>
                )}
                {erro?.onde === p.id ? (
                  <p role="alert" className="text-secundario text-bad">
                    {erro.texto}
                  </p>
                ) : null}
              </Card>
            </li>
          )
        })}
      </ul>

      {criando ? (
        <Card className="flex flex-col gap-3 p-3">
          <Select rotulo="Tipo" value={novo.kind} onChange={(e) => setNovo({ ...novo, kind: e.target.value })}>
            <option value="interno">Prazo interno</option>
            <option value="fatal">Prazo fatal</option>
            <option value="audiencia">Audiência</option>
            <option value="contratual">Prazo contratual</option>
          </Select>
          <Input rotulo="O que fazer" value={novo.title} onChange={(e) => setNovo({ ...novo, title: e.target.value })} maxLength={200} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input rotulo={novo.kind === 'audiencia' ? 'Dia' : 'Vence em'} type="date" value={novo.dueOn} onChange={(e) => setNovo({ ...novo, dueOn: e.target.value })} />
            {novo.kind === 'audiencia' ? (
              <Input rotulo="Hora" type="time" value={novo.hora} onChange={(e) => setNovo({ ...novo, hora: e.target.value })} />
            ) : (
              <Input rotulo="Fazer até (interno)" type="date" value={novo.internalDueOn} onChange={(e) => setNovo({ ...novo, internalDueOn: e.target.value })} ajuda="Opcional." />
            )}
          </div>
          {erro?.onde === 'novo' ? (
            <p role="alert" className="text-secundario text-bad">
              {erro.texto}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              tamanho="sm"
              carregando={pendente}
              disabled={novo.title.trim().length < 2 || !novo.dueOn}
              motivoDesabilitado="Escreva o que fazer e escolha a data."
              onClick={criar}
            >
              Criar prazo
            </Button>
            <Button tamanho="sm" variante="ghost" onClick={() => setCriando(false)}>
              Voltar
            </Button>
          </div>
        </Card>
      ) : (
        <Button tamanho="sm" variante="secondary" className="self-start" onClick={() => setCriando(true)}>
          <Plus aria-hidden className="size-4" />
          Prazo
        </Button>
      )}
    </div>
  )
}
