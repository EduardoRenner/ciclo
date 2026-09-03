'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { diaDaquiA } from '@/core/tempo/dia'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import MoneyInput from '@/components/ui/money-input'
import PhoneInput from '@/components/ui/phone-input'
import Select from '@/components/ui/select'
import Textarea from '@/components/ui/textarea'
import { dinheiro, formatarTelefone } from '@/lib/formato'

type Profissional = { id: string; display_name: string }
type Item = { description: string; qty: string; unitPriceCents: number }

const ITEM_VAZIO: Item = { description: '', qty: '1', unitPriceCents: 0 }

export default function FormularioOrcamento({
  profissionais,
  timezone,
}: {
  profissionais: Profissional[]
  /** Fuso do salao: a validade e uma data de calendario, e calendario e do salao, nao do aparelho. */
  timezone: string
}) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()

  const [professionalId, setProfessionalId] = useState(profissionais[0]?.id ?? '')
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [itens, setItens] = useState<Item[]>([{ ...ITEM_VAZIO }])
  const [validade, setValidade] = useState<'sem_validade' | '7' | '15' | '30'>('15')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [linkPronto, setLinkPronto] = useState<{ url: string; whatsapp: string } | null>(null)

  const clienteId = useSearchParams().get('cliente')
  useEffect(() => {
    if (!clienteId) return
    let cancelado = false
    fetch(`/api/v1/clients/${clienteId}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ data?: { name: string; phone_e164: string | null } }>) : null))
      .then((json) => {
        if (cancelado || !json?.data) return
        setClienteNome(json.data.name)
        setClienteTelefone(formatarTelefone(json.data.phone_e164) ?? '')
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [clienteId])

  const totalCents = itens.reduce((soma, i) => soma + Math.ceil((Number(i.qty.replace(',', '.')) || 0) * i.unitPriceCents), 0)

  function atualizarItem(index: number, campo: keyof Item, valor: string | number) {
    setItens((atual) => atual.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)))
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    /*
     * Era `new Date(...).toISOString().slice(0, 10)` — "daqui a N dias em UTC", nao no salao. Em
     * Brasilia, um orcamento feito das 21h a meia-noite nascia valendo um dia a MAIS do que a
     * pessoa combinou.
     *
     * E a metade errada de uma costura: quem confere a expiracao (`orcamentoExpirado`, em
     * `orcamentos.ts`) ja usa `tenant.timezone` corretamente. Gravar no fuso do servidor e conferir
     * no fuso do salao e ter duas ideias diferentes de "que dia e hoje" nas duas pontas da mesma
     * regra.
     */
    const validUntil = validade === 'sem_validade' ? null : diaDaquiA(timezone, Number(validade))

    const corpo = {
      clientDraft: { name: clienteNome, phone: clienteTelefone },
      professionalId,
      items: itens
        .filter((i) => i.description.trim())
        .map((i) => ({ description: i.description, qty: Number(i.qty.replace(',', '.')) || 1, unitPriceCents: i.unitPriceCents })),
      validUntil,
      message: mensagem.trim() || null,
    }

    if (corpo.items.length === 0) {
      setErro('Adicione pelo menos um item com descrição.')
      return
    }

    iniciarTransicao(async () => {
      try {
        const r = await fetch('/api/v1/quotes', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify(corpo),
        })
        const json = (await r.json()) as { data?: { url: string }; error?: { message: string } }

        if (r.ok && json.data) {
          const mensagemWhats = `Oi! Segue o orçamento: ${json.data.url}`
          const digitos = clienteTelefone.replace(/\D/g, '')
          setLinkPronto({ url: json.data.url, whatsapp: `https://wa.me/55${digitos}?text=${encodeURIComponent(mensagemWhats)}` })
          return
        }

        setErro(json.error?.message ?? 'Não consegui criar o orçamento.')
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  if (linkPronto) {
    return (
      <Card className="flex flex-col gap-3">
        <p className="text-corpo font-semibold text-txt">Orçamento pronto · {dinheiro.format(totalCents / 100)}</p>
        <a
          href={linkPronto.whatsapp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc"
        >
          Mandar pelo WhatsApp
        </a>
        <Button variante="secondary" largura="cheia" onClick={() => router.push('/admin/agenda')}>
          Voltar pra agenda
        </Button>
      </Card>
    )
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      {profissionais.length > 1 ? (
        <Select rotulo="Profissional" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} required>
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </Select>
      ) : null}

      <Input rotulo="Cliente" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Nome" autoComplete="name" required />
      <PhoneInput valor={clienteTelefone} aoMudar={setClienteTelefone} required />

      <div className="flex flex-col gap-3">
        <p className="text-secundario font-semibold text-txt-3">Itens do orçamento</p>
        {itens.map((item, index) => (
          <Card key={index} className="flex flex-col gap-2">
            <Input
              rotulo="Descrição"
              value={item.description}
              onChange={(e) => atualizarItem(index, 'description', e.target.value)}
              placeholder="Ex.: Mão de obra"
            />
            <div className="flex items-end gap-2">
              <Input
                rotulo="Qtd."
                type="text"
                inputMode="decimal"
                value={item.qty}
                onChange={(e) => atualizarItem(index, 'qty', e.target.value)}
                classNameCampo="tabular"
              />
              <MoneyInput rotulo="Preço" centavos={item.unitPriceCents} aoMudar={(c) => atualizarItem(index, 'unitPriceCents', c)} />
              {itens.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setItens((atual) => atual.filter((_, i) => i !== index))}
                  className="mb-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-bad"
                  aria-label="Remover item"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              ) : null}
            </div>
          </Card>
        ))}
        <button
          type="button"
          onClick={() => setItens((atual) => [...atual, { ...ITEM_VAZIO }])}
          className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 text-corpo font-semibold text-txt-2"
        >
          <Plus aria-hidden className="size-4" />
          Adicionar item
        </button>
      </div>

      <Select rotulo="Vale por" value={validade} onChange={(e) => setValidade(e.target.value as typeof validade)}>
        <option value="7">7 dias</option>
        <option value="15">15 dias</option>
        <option value="30">30 dias</option>
        <option value="sem_validade">Sem data para vencer</option>
      </Select>

      <Textarea rotulo="Mensagem (opcional)" value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Ex.: Inclui material e mão de obra" />

      <Card className="flex items-center justify-between">
        <span className="text-corpo font-semibold text-txt-2">Total</span>
        <span className="tabular text-titulo font-bold text-acc-2">{dinheiro.format(totalCents / 100)}</span>
      </Card>

      {erro ? (
        <Card className="border-bad/40">
          <p role="alert" className="text-corpo font-semibold text-bad">
            {erro}
          </p>
        </Card>
      ) : null}

      <Button
        type="submit"
        largura="cheia"
        carregando={pendente}
        disabled={profissionais.length === 0}
        motivoDesabilitado="Cadastre pelo menos um profissional em Configurações para montar um orçamento."
      >
        Criar orçamento
      </Button>
    </form>
  )
}
