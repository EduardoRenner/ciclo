'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { FlaskConical } from 'lucide-react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import Input from '@/components/ui/input'
import SectionHeader from '@/components/ui/section-header'
import Select from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import type { Metrica } from '@/core/experimentos/experimento'
import type { Experimento } from '@/server/services/experimentos'

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const
const DURACOES = [7, 14, 21, 28] as const

const ROTULO_DA_METRICA: Record<Metrica, string> = {
  atendimentos: 'quantos atendimentos',
  atendido_cents: 'valor atendido',
}

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`

type ErroDaApi = { error?: { message?: string; details?: { fields?: Record<string, string> } } }

/**
 * docs/84 Aposta C. O formulário pede só o que a comparação usa: o que muda, o que olhar, se é um
 * dia da semana, quando começa e por quanto tempo. O "antes" é guardado no momento em que o teste é
 * criado — por isso o início é hoje ou depois (a rota recusa o passado).
 */
export default function Experimentos({ inicial, podeCriar, hoje }: { inicial: Experimento[]; podeCriar: boolean; hoje: string }) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [pendente, iniciarTransicao] = useTransition()
  const [titulo, setTitulo] = useState('')
  const [metrica, setMetrica] = useState<Metrica>('atendimentos')
  const [weekday, setWeekday] = useState<string>('')
  const [startsOn, setStartsOn] = useState(hoje)
  const [dias, setDias] = useState<number>(14)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)

  function criar() {
    setErros({})
    setErroGeral(null)
    iniciarTransicao(async () => {
      try {
        const r = await fetch('/api/v1/experiments', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ titulo, metrica, weekday: weekday === '' ? null : Number(weekday), startsOn, dias }),
        })
        if (!r.ok) {
          const json = (await r.json().catch(() => null)) as ErroDaApi | null
          const campos = json?.error?.details?.fields
          if (campos && Object.keys(campos).length > 0) setErros(campos)
          else setErroGeral(json?.error?.message ?? 'Não consegui começar o teste.')
          return
        }
        setTitulo('')
        mostrarToast({ tom: 'ok', titulo: 'Teste guardado', descricao: 'O antes já está anotado. O resultado sai quando o teste acabar.' })
        router.refresh()
      } catch {
        // Sem este `catch`, o React 19 relança para o error boundary e a tela some com o que foi digitado.
        setErroGeral('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  function cancelar(id: string) {
    setCancelando(id)
    iniciarTransicao(async () => {
      try {
        const r = await fetch(`/api/v1/experiments/${id}/cancel`, { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() } })
        if (!r.ok) {
          const json = (await r.json().catch(() => null)) as ErroDaApi | null
          mostrarToast({ tom: 'erro', titulo: 'Não consegui cancelar', descricao: json?.error?.message ?? 'Tente de novo em instantes.' })
          return
        }
        mostrarToast({ tom: 'ok', titulo: 'Teste cancelado' })
        router.refresh()
      } catch {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui cancelar', descricao: 'Sem conexão agora. Nada mudou.' })
      } finally {
        setCancelando(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {podeCriar ? (
        <Card id="novo-teste">
          <p className="text-corpo font-semibold">Começar um teste</p>
          <div className="mt-3 flex flex-col gap-3">
            <Input
              rotulo="O que você vai mudar?"
              ajuda='Por exemplo: "abrir a quinta até as 21h" ou "postar a agenda todo domingo".'
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={120}
              erro={erros.titulo}
            />
            <Select rotulo="O que olhar" value={metrica} onChange={(e) => setMetrica(e.target.value as Metrica)} erro={erros.metrica}>
              <option value="atendimentos">Quantos atendimentos</option>
              <option value="atendido_cents">Valor atendido</option>
            </Select>
            <Select
              rotulo="Só um dia da semana?"
              ajuda="Se a mudança é num dia só, compare só esse dia: os outros diluem o efeito."
              value={weekday}
              onChange={(e) => setWeekday(e.target.value)}
              erro={erros.weekday}
            >
              <option value="">Todos os dias</option>
              {DIAS_DA_SEMANA.map((d, i) => (
                <option key={d} value={String(i)}>
                  Só {d}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input rotulo="Começa em" type="date" min={hoje} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} erro={erros.startsOn} />
              <Select rotulo="Por quanto tempo" value={String(dias)} onChange={(e) => setDias(Number(e.target.value))} erro={erros.dias}>
                {DURACOES.map((d) => (
                  <option key={d} value={String(d)}>
                    {d} dias
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {erroGeral ? (
            <p role="alert" className="mt-3 text-secundario text-bad">
              {erroGeral}
            </p>
          ) : null}
          <Button className="mt-4" largura="cheia" onClick={criar} carregando={pendente && cancelando === null}>
            Começar o teste
          </Button>
        </Card>
      ) : null}

      <section aria-labelledby="titulo-testes">
        <SectionHeader>
          <span id="titulo-testes">Seus testes</span>
        </SectionHeader>
        {inicial.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icone={<FlaskConical aria-hidden className="size-6" />}
              titulo="Nenhum teste ainda"
              descricao="Quando você mudar alguma coisa no negócio, registre aqui antes. Assim dá para saber se fez diferença."
              acao={
                podeCriar ? (
                  <Button
                    variante="secondary"
                    onClick={() => {
                      const campo = document.querySelector<HTMLInputElement>('#novo-teste input')
                      campo?.scrollIntoView({ block: 'center' })
                      campo?.focus()
                    }}
                  >
                    Começar um teste
                  </Button>
                ) : (
                  <Link href="/admin/mes">Ver o mês</Link>
                )
              }
            />
          </Card>
        ) : (
          <ul className="grid gap-2">
            {inicial.map((e) => (
              <li key={e.id}>
                <Card>
                  <p className="text-corpo font-semibold">{e.titulo}</p>
                  <p className="mt-0.5 text-label text-txt-3">
                    {e.dias} dias a partir de {ddmm(e.startsOn)} · {ROTULO_DA_METRICA[e.metrica]}
                    {e.weekday !== null ? ` · só ${DIAS_DA_SEMANA[e.weekday]}` : ''}
                  </p>
                  <p className="mt-2 text-secundario text-txt-2">{e.leitura.frase}</p>
                  {e.leitura.amostra ? <p className="mt-1 text-label text-txt-3">{e.leitura.amostra}</p> : null}
                  {podeCriar && (e.leitura.estado === 'agendado' || e.leitura.estado === 'rodando') ? (
                    <Button variante="ghost" tamanho="sm" className="mt-2 -ml-2" onClick={() => cancelar(e.id)} carregando={cancelando === e.id}>
                      Cancelar teste
                    </Button>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
