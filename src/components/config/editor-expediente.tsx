'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

type Bloco = { weekday: number; opens_at: string; closes_at: string }
type Folga = { id: string; starts_at: string; ends_at: string; reason: string | null }

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/**
 * Conversão de fuso fica para quando o `date-fns-tz`/Temporal da PARTE 2 §1
 * entrar (nenhum ticket ainda instalou essa camada). Por ora o horário do
 * navegador é tratado como o do tenant — America/Sao_Paulo é o único fuso em
 * uso na família até aqui.
 */
function paraIso(dataLocal: string): string {
  return new Date(dataLocal).toISOString()
}

function paraInputLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * `professionalId: null` é o expediente/folga padrão do negócio inteiro —
 * `time_off.professional_id` já é nullable com esse sentido exato desde a
 * 0001 ("null = fecha o estabelecimento"), e `business-hours/[id]` já aceita
 * o literal `default` na URL pra isso. Compartilhado entre o editor por
 * profissional (`config/profissionais/[id]/`) e o de horário do negócio
 * (`config/horarios/`) — dois editores de semana seriam o mesmo código
 * duas vezes.
 */
export default function EditorExpediente({
  professionalId,
  expedienteInicial,
  folgasIniciais,
}: {
  professionalId: string | null
  expedienteInicial: Bloco[]
  folgasIniciais: Folga[]
}) {
  const [blocos, setBlocos] = useState(expedienteInicial)
  const [folgas, setFolgas] = useState(folgasIniciais)
  const [pendente, iniciarTransicao] = useTransition()
  const mostrarToast = useToast()

  const segmentoUrl = professionalId ?? 'default'

  /**
   * A tela mudava ANTES da resposta e não voltava atrás quando o servidor recusava: só saía um
   * toast, e os blocos continuavam mostrando o horário novo. Quem trocasse "terça abre 10:00" e
   * lesse o erro de passagem fechava a tela acreditando que estava salvo — e a agenda continuava
   * abrindo às 09:00, sem nada na interface para desmentir.
   *
   * É a armadilha do `catch` que descarta, do `CLAUDE.md`: o erro era CONTADO (o toast) mas o
   * efeito dele não era desfeito. Um `PUT` que falha por módulo de plano, por rede caída ou por
   * conflito termina igual — a tela precisa voltar ao que o banco tem.
   *
   * O estado anterior é capturado antes do `set`, e não lido de `blocos` dentro da transição:
   * dois toques rápidos deixariam o segundo restaurando o valor que o primeiro já tinha trocado.
   */
  function salvarExpediente(novos: Bloco[]) {
    const anterior = blocos
    setBlocos(novos)
    iniciarTransicao(async () => {
      try {
        const r = await fetch(`/api/v1/professionals/${segmentoUrl}/business-hours`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({
            professionalId,
            blocos: novos.map((b) => ({ weekday: b.weekday, opensAt: b.opens_at.slice(0, 5), closesAt: b.closes_at.slice(0, 5) })),
          }),
        })
        if (!r.ok) {
          const json = (await r.json().catch(() => ({}))) as { error?: { message?: string } }
          setBlocos(anterior)
          mostrarToast({
            tom: 'erro',
            titulo: 'Não consegui salvar o expediente',
            descricao: json.error?.message ?? 'Voltei o horário para o que estava salvo. Tente de novo.',
          })
        }
      } catch {
        // Rede caiu no meio: sem o `try`, o React 19 relança a Action para o error boundary da
        // raiz e a tela inteira some (armadilha do `CLAUDE.md`).
        setBlocos(anterior)
        mostrarToast({
          tom: 'erro',
          titulo: 'Não consegui falar com o servidor',
          descricao: 'Voltei o horário para o que estava salvo. Confira a conexão e tente de novo.',
        })
      }
    })
  }

  function adicionarBloco(weekday: number) {
    salvarExpediente([...blocos, { weekday, opens_at: '09:00', closes_at: '18:00' }])
  }

  function removerBloco(indice: number) {
    salvarExpediente(blocos.filter((_, i) => i !== indice))
  }

  function atualizarBloco(indice: number, campo: 'opens_at' | 'closes_at', valor: string) {
    salvarExpediente(blocos.map((b, i) => (i === indice ? { ...b, [campo]: valor } : b)))
  }

  /**
   * `formulario` chega para poder ser limpo NO SUCESSO, e só nele — a distinção é o conserto
   * inteiro.
   *
   * Este formulário usava `<form action={criarFolga}>`, e no React 19 isso reseta os campos quando
   * a ação termina, **inclusive quando ela falhou**. Aqui os três campos são não controlados (duas
   * datas com `defaultValue` e o motivo), então uma falha apagava as datas escolhidas e o motivo
   * digitado, e a pessoa recomeçava.
   *
   * Diferente das telas de autenticação, aqui limpar depois do SUCESSO é desejável: quem acabou de
   * cadastrar uma folga costuma cadastrar a próxima. Por isso o reset passou a ser explícito, no
   * caminho feliz, em vez de automático nos dois.
   */
  function criarFolga(formData: FormData, formulario: HTMLFormElement) {
    const inicio = String(formData.get('inicio') ?? '')
    const fim = String(formData.get('fim') ?? '')
    const motivo = String(formData.get('motivo') ?? '').trim() || undefined

    iniciarTransicao(async () => {
      const r = await fetch('/api/v1/time-off', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ professionalId, startsAt: paraIso(inicio), endsAt: paraIso(fim), reason: motivo }),
      })
      const json = (await r.json()) as { data?: Folga; error?: { message: string } }
      if (!r.ok || !json.data) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui salvar a folga', descricao: json.error?.message ?? '' })
        return
      }
      setFolgas((atual) => [...atual, json.data!])
      // Só aqui: a folga entrou na lista, o formulário fica pronto para a próxima.
      formulario.reset()
    })
  }

  function removerFolga(id: string) {
    setFolgas((atual) => atual.filter((f) => f.id !== id))
    iniciarTransicao(async () => {
      await fetch(`/api/v1/time-off/${id}`, { method: 'DELETE', headers: { 'idempotency-key': crypto.randomUUID() } })
    })
  }

  return (
    <div aria-busy={pendente} className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Expediente</h2>
        <div className="flex flex-col gap-2">
          {DIAS.map((nome, weekday) => {
            const doDia = blocos
              .map((b, indiceOriginal) => ({ ...b, indiceOriginal }))
              .filter((b) => b.weekday === weekday)

            return (
              <Card key={weekday}>
                <div className="flex items-center justify-between">
                  <p className="text-corpo font-semibold">{nome}</p>
                  <button
                    type="button"
                    aria-label={`Adicionar intervalo em ${nome}`}
                    onClick={() => adicionarBloco(weekday)}
                    /*
                       Medido em 32×32px nos sete dias — abaixo do piso de 48px
                       do CLAUDE.md. Mesma sobra que a Parte III achou em
                       `fidelidade.tsx`: componente escrito depois da varredura
                       de alvos. `toque-48` estende a área tocável sem engordar
                       o desenho, que a 32px é o certo ao lado do nome do dia.
                    */
                    className="toque-48 flex size-8 items-center justify-center rounded-[var(--radius-pill)] bg-acc-soft text-acc-2"
                  >
                    <Plus aria-hidden className="size-4" />
                  </button>
                </div>

                {doDia.length === 0 ? (
                  <p className="mt-1 text-secundario text-txt-3">Fechado</p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {doDia.map((b) => (
                      <div key={b.indiceOriginal} className="flex items-center gap-2">
                        {/*
                          O "até" entre os dois campos resolve para quem
                          enxerga, mas o leitor de tela anunciava "time" dez
                          vezes seguidas, sem dia e sem saber qual é abertura
                          e qual é fechamento. O formulário de folga logo
                          abaixo, no mesmo arquivo, já usa `<label>` de
                          verdade — estes dois eram a inconsistência.
                        */}
                        <input
                          type="time"
                          aria-label={`${nome}, abre às`}
                          value={b.opens_at.slice(0, 5)}
                          onChange={(e) => atualizarBloco(b.indiceOriginal, 'opens_at', e.target.value)}
                          className="h-12 flex-1 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
                        />
                        <span aria-hidden className="text-txt-3">
                          até
                        </span>
                        <input
                          type="time"
                          aria-label={`${nome}, fecha às`}
                          value={b.closes_at.slice(0, 5)}
                          onChange={(e) => atualizarBloco(b.indiceOriginal, 'closes_at', e.target.value)}
                          className="h-12 flex-1 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
                        />
                        <button
                          type="button"
                          aria-label="Remover este intervalo"
                          onClick={() => removerBloco(b.indiceOriginal)}
                          className="flex size-12 items-center justify-center text-bad"
                        >
                          <Trash2 aria-hidden className="size-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
          {professionalId ? 'Folgas' : 'Fechamentos (feriados, férias coletivas)'}
        </h2>

        {folgas.length > 0 ? (
          <ul className="mb-3 flex flex-col gap-2">
            {folgas.map((f) => (
              <li key={f.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-corpo font-semibold">
                      {new Date(f.starts_at).toLocaleDateString('pt-BR')} – {new Date(f.ends_at).toLocaleDateString('pt-BR')}
                    </p>
                    {f.reason ? <p className="text-secundario text-txt-2">{f.reason}</p> : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Remover folga"
                    onClick={() => removerFolga(f.id)}
                    className="flex size-12 items-center justify-center text-bad"
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}

        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              criarFolga(new FormData(e.currentTarget), e.currentTarget)
            }}
            className="flex flex-col gap-3"
          >
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">Início</span>
              <input
                name="inicio"
                type="datetime-local"
                required
                defaultValue={paraInputLocal(new Date().toISOString())}
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">Fim</span>
              <input
                name="fim"
                type="datetime-local"
                required
                defaultValue={paraInputLocal(new Date().toISOString())}
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">Motivo (opcional)</span>
              <input
                name="motivo"
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
              />
            </label>
            <Button type="submit" largura="cheia" carregando={pendente}>
              Adicionar
            </Button>
          </form>
        </Card>
      </section>
    </div>
  )
}
