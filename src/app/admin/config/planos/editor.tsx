'use client'

import { Repeat } from 'lucide-react'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import Input from '@/components/ui/input'
import MoneyInput from '@/components/ui/money-input'
import Sheet from '@/components/ui/sheet'
import Textarea from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { dinheiro } from '@/lib/formato'

type Plano = { id: string; name: string; price_cents: number; sessions_per_month: number | null; benefits: string | null; active: boolean }

export default function EditorPlanos({ iniciais }: { iniciais: Plano[] }) {
  const mostrarToast = useToast()
  const [planos, setPlanos] = useState(iniciais)
  const [criando, setCriando] = useState(false)
  const [pendente, iniciarTransicao] = useTransition()

  const [nome, setNome] = useState('')
  const [precoCentavos, setPrecoCentavos] = useState(0)
  const [ilimitado, setIlimitado] = useState(true)
  const [sessoes, setSessoes] = useState('4')
  const [beneficios, setBeneficios] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function salvar() {
    setErro(null)
    iniciarTransicao(async () => {
      try {
        const r = await fetch('/api/v1/subscription-plans', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({
            name: nome,
            priceCents: precoCentavos,
            sessionsPerMonth: ilimitado ? null : Number(sessoes),
            benefits: beneficios.trim() || null,
          }),
        })
        const json = (await r.json()) as { data?: Plano; error?: { message: string; details?: { fields?: Record<string, string> } } }
        if (!r.ok || !json.data) {
          const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
          setErro(campo ?? json.error?.message ?? 'Não consegui salvar.')
          return
        }
        setPlanos((atual) => [...atual, json.data!])
        mostrarToast({ tom: 'ok', titulo: 'Plano criado' })
        setCriando(false)
        setNome('')
        setPrecoCentavos(0)
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  return (
    <div className="pb-8">
      <Button variante="secondary" largura="cheia" onClick={() => setCriando(true)} className="mb-4">
        Criar plano
      </Button>

      {planos.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icone={<Repeat aria-hidden className="size-6" />}
            titulo="Nenhum plano ainda"
            descricao="Crie um plano mensal. Ele aparece na ficha de cada cliente para assinar."
            acao={<Button onClick={() => setCriando(true)}>Criar o primeiro</Button>}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {planos.map((p) => (
            <li key={p.id}>
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-corpo font-semibold">{p.name}</p>
                  <p className="tabular text-corpo font-bold text-acc-2">{dinheiro.format(p.price_cents / 100)}/mês</p>
                </div>
                <p className="mt-1 text-secundario text-txt-2">
                  {p.sessions_per_month ? `${p.sessions_per_month}x por mês` : 'Atendimentos ilimitados'}
                </p>
                {p.benefits ? <p className="mt-1 text-secundario text-txt-3">{p.benefits}</p> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet aberto={criando} aoFechar={(a) => !a && setCriando(false)} titulo="Novo plano">
        <div className="flex flex-col gap-3">
          <Input
            rotulo="Nome do plano"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Corte ilimitado"
          />
          <MoneyInput rotulo="Preço mensal" centavos={precoCentavos} aoMudar={setPrecoCentavos} />

          <label className="flex min-h-12 items-center gap-3 py-1">
            <input
              type="checkbox"
              checked={ilimitado}
              onChange={(e) => setIlimitado(e.target.checked)}
              className="size-5 shrink-0 accent-[var(--acc-2)]"
            />
            <span className="text-corpo text-txt">Atendimentos ilimitados por mês</span>
          </label>

          {!ilimitado ? (
            <Input
              rotulo="Quantos por mês"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={sessoes}
              onChange={(e) => setSessoes(e.target.value)}
              classNameCampo="tabular"
            />
          ) : null}

          <Textarea
            rotulo="Outros benefícios (opcional)"
            value={beneficios}
            onChange={(e) => setBeneficios(e.target.value)}
            rows={2}
            placeholder="Desconto em produto, prioridade na agenda..."
          />

          {erro ? (
            <p role="alert" className="text-secundario text-bad">
              {erro}
            </p>
          ) : null}

          <Button largura="cheia" carregando={pendente} onClick={salvar}>
            Criar plano
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
