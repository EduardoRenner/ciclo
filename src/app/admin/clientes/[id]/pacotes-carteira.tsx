'use client'

import { Package, Plus, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import MoneyInput from '@/components/ui/money-input'
import Select from '@/components/ui/select'
import SectionHeader from '@/components/ui/section-header'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { dinheiro } from '@/lib/formato'

type Props = {
  clientId: string
  pacotes: { id: string; serviceName: string; restantes: number; total: number; expiresOn: string | null }[]
  saldoCarteiraCents: number
  servicos: { id: string; name: string; priceCents: number }[]
  /** `comanda:own` — recepção não vende pacote nem lança crédito (§3.3). */
  podeLancar: boolean
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * Pacotes (TICKET-046) e carteira (TICKET-047) existiam com rota, serviço e teste, e esta seção
 * era **só leitura**: dava para ver o saldo e nunca para lançar um. Consumir acontece na comanda,
 * mas *vender* o pacote e *creditar* a carteira (sinal virado crédito, cortesia, fiado pago) só
 * existiam como endpoint — na prática, funcionalidade inacessível. Ver `docs/12-AUDITORIA-DE-PRODUTO.md`.
 */
export default function PacotesCarteira({ clientId, pacotes, saldoCarteiraCents, servicos, podeLancar }: Props) {
  const [abrindo, setAbrindo] = useState<'pacote' | 'credito' | null>(null)

  return (
    <section className="mt-7">
      <SectionHeader icone={<Package className="size-3.5" />}>Pacotes e carteira</SectionHeader>
      <div className="grid gap-2">
        {saldoCarteiraCents !== 0 ? (
          <Card className="flex items-center gap-3">
            <Wallet className={saldoCarteiraCents > 0 ? 'size-5 shrink-0 text-ok' : 'size-5 shrink-0 text-bad'} />
            <div className="min-w-0 flex-1">
              <p className="text-corpo font-semibold">Saldo na carteira</p>
              <p className="text-secundario text-txt-2">
                {saldoCarteiraCents < 0 ? 'Cliente deve ' : 'Cliente tem '}
                {dinheiro.format(Math.abs(saldoCarteiraCents) / 100)}
              </p>
            </div>
          </Card>
        ) : null}

        {pacotes.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-corpo font-semibold">{p.serviceName}</p>
              <p className="tabular shrink-0 text-corpo font-bold text-acc-2">
                {p.restantes}/{p.total}
              </p>
            </div>
            {p.expiresOn ? <p className="mt-0.5 text-secundario text-txt-3">Vence em {dataCurta(p.expiresOn)}</p> : null}
          </Card>
        ))}

        {pacotes.length === 0 && saldoCarteiraCents === 0 ? (
          <p className="text-secundario text-txt-3">
            Nada contratado ainda.
            {podeLancar ? ' Um pacote de sessões pagas na frente é o jeito mais direto de garantir que ela volte.' : ''}
          </p>
        ) : null}

        {/* Botão que sempre devolveria 403 é pior que botão ausente: some para quem não pode lançar. */}
        {podeLancar ? (
          <div className="flex flex-wrap gap-2">
            <Button tamanho="sm" variante="secondary" onClick={() => setAbrindo('pacote')}>
              <Plus aria-hidden className="size-4" />
              Vender pacote
            </Button>
            <Button tamanho="sm" variante="ghost" onClick={() => setAbrindo('credito')}>
              Lançar crédito
            </Button>
          </div>
        ) : null}
      </div>

      {abrindo === 'pacote' ? (
        <VenderPacote clientId={clientId} servicos={servicos} aoFechar={() => setAbrindo(null)} />
      ) : null}
      {abrindo === 'credito' ? <LancarCredito clientId={clientId} aoFechar={() => setAbrindo(null)} /> : null}
    </section>
  )
}

function VenderPacote({
  clientId,
  servicos,
  aoFechar,
}: {
  clientId: string
  servicos: { id: string; name: string; priceCents: number }[]
  aoFechar: () => void
}) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [serviceId, setServiceId] = useState(servicos[0]?.id ?? '')
  const [sessoes, setSessoes] = useState('4')
  // Começa no preço cheio das sessões: quase todo pacote tem desconto, e é mais
  // fácil abater de um número certo do que digitar o total do zero.
  const [pagoCents, setPagoCents] = useState((servicos[0]?.priceCents ?? 0) * 4)
  const [vence, setVence] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  const quantidade = Number(sessoes)

  function trocarServico(id: string) {
    setServiceId(id)
    const preco = servicos.find((s) => s.id === id)?.priceCents ?? 0
    setPagoCents(preco * (Number.isFinite(quantidade) ? quantidade : 1))
  }

  function trocarSessoes(valor: string) {
    setSessoes(valor)
    const preco = servicos.find((s) => s.id === serviceId)?.priceCents ?? 0
    const n = Number(valor)
    if (Number.isFinite(n) && n > 0) setPagoCents(preco * n)
  }

  function salvar() {
    if (!serviceId) {
      setErro('Escolha o serviço do pacote.')
      return
    }
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100) {
      setErro('O pacote precisa ter de 1 a 100 sessões.')
      return
    }
    setErro(null)

    iniciar(async () => {
      const r = await fetch('/api/v1/packages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          clientId,
          serviceId,
          totalSessions: quantidade,
          paidCents: pagoCents,
          expiresOn: vence || undefined,
        }),
      })
      const json = (await r.json()) as { error?: { message?: string; details?: { fields?: Record<string, string> } } }
      if (!r.ok) {
        setErro(json.error?.details?.fields ? Object.values(json.error.details.fields)[0]! : (json.error?.message ?? 'Não consegui vender o pacote.'))
        return
      }
      aoFechar()
      mostrarToast({ tom: 'ok', titulo: 'Pacote vendido', descricao: 'As sessões já podem ser usadas na comanda.' })
      router.refresh()
    })
  }

  return (
    <Sheet aberto aoFechar={(aberto) => !aberto && aoFechar()} titulo="Vender pacote" descricao="Sessões pagas na frente, consumidas na comanda.">
      <div className="flex flex-col gap-3">
        <Select rotulo="Serviço" value={serviceId} onChange={(e) => trocarServico(e.target.value)}>
          {servicos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Input rotulo="Quantas sessões" value={sessoes} onChange={(e) => trocarSessoes(e.target.value)} inputMode="numeric" />
        <MoneyInput rotulo="Quanto ela pagou" centavos={pagoCents} aoMudar={setPagoCents} ajuda="Já vem no preço cheio das sessões; ajuste se houver desconto." />
        <Input rotulo="Vence em (opcional)" type="date" value={vence} onChange={(e) => setVence(e.target.value)} />

        {erro ? (
          <p role="alert" className="text-secundario text-bad">
            {erro}
          </p>
        ) : null}

        <Button largura="cheia" carregando={salvando} onClick={salvar}>
          Vender pacote
        </Button>
      </div>
    </Sheet>
  )
}

function LancarCredito({ clientId, aoFechar }: { clientId: string; aoFechar: () => void }) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [valorCents, setValorCents] = useState(0)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function salvar() {
    if (valorCents < 1) {
      setErro('Diga o valor do crédito.')
      return
    }
    if (!motivo.trim()) {
      setErro('Escreva o motivo — é o que você vai ler daqui a três meses.')
      return
    }
    setErro(null)

    iniciar(async () => {
      const r = await fetch('/api/v1/wallet/credit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ clientId, amountCents: valorCents, reason: motivo.trim() }),
      })
      const json = (await r.json()) as { error?: { message?: string; details?: { fields?: Record<string, string> } } }
      if (!r.ok) {
        setErro(json.error?.details?.fields ? Object.values(json.error.details.fields)[0]! : (json.error?.message ?? 'Não consegui lançar o crédito.'))
        return
      }
      aoFechar()
      mostrarToast({ tom: 'ok', titulo: 'Crédito lançado', descricao: 'O saldo aparece na comanda dela.' })
      router.refresh()
    })
  }

  return (
    <Sheet
      aberto
      aoFechar={(aberto) => !aberto && aoFechar()}
      titulo="Lançar crédito"
      descricao="Sinal que virou crédito, cortesia, troco que ficou."
    >
      <div className="flex flex-col gap-3">
        <MoneyInput rotulo="Valor do crédito" centavos={valorCents} aoMudar={setValorCents} />
        <Input
          rotulo="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={200}
          ajuda="Fica registrado no histórico da carteira."
        />

        {erro ? (
          <p role="alert" className="text-secundario text-bad">
            {erro}
          </p>
        ) : null}

        <Button largura="cheia" carregando={salvando} onClick={salvar}>
          Lançar crédito
        </Button>
      </div>
    </Sheet>
  )
}
