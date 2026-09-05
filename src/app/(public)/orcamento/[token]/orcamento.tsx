'use client'

import { CheckCircle2, Clock, FileX } from 'lucide-react'
import { useEffect, useState } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import ErroPublico from '@/components/ui/erro-publico'
import Textarea from '@/components/ui/textarea'
import { dinheiro } from '@/lib/formato'

type Item = { description: string; qty: number; unitPriceCents: number; totalCents: number }
type Dados = { status: string; totalCents: number; validUntil: string | null; message: string | null; businessName: string; items: Item[] }
type Estado = 'carregando' | 'pronto' | 'recusando' | 'aprovado' | 'recusado' | 'erro'

/**
 * Qual tela mostrar — e o motivo de isto ser função em vez de uma sequência de `if` no render.
 *
 * Até 2026-08-27 o primeiro `if` era `estado === 'carregando' || !dados`, e o de erro vinha
 * DEPOIS. O `|| !dados` estava lá para o TypeScript estreitar `dados` no resto da função — mas
 * **erro é justamente o caso em que `dados` é `null`**, então o ramo de erro nunca era alcançado.
 *
 * Medido no ar: com token inválido, a API responde **404 em ~400 ms** com a mensagem certa
 * ("Link inválido ou expirado.") e a tela ficava em *"Carregando orçamento…"* **para sempre** —
 * mais de 15 s sem mensagem, sem ação, sem saída. O servidor fazia tudo certo e o cliente
 * engolia. O irmão `/avaliar` não tem o `|| !dados` e por isso sempre funcionou.
 *
 * Pura e exportada porque este projeto não tem harness de render de componente — mesmo padrão de
 * `deveMostrarHeroiDoMotor` em `admin/hoje/hoje.tsx`. A ordem é a regra: **erro antes de
 * carregando**, sempre.
 */
export type TelaDoOrcamento = 'erro' | 'carregando' | 'aprovado' | 'recusado' | 'conteudo'

export function telaDoOrcamento(estado: Estado, temDados: boolean): TelaDoOrcamento {
  if (estado === 'erro') return 'erro'
  if (estado === 'carregando' || !temDados) return 'carregando'
  if (estado === 'aprovado') return 'aprovado'
  if (estado === 'recusado') return 'recusado'
  return 'conteudo'
}

/**
 * docs/09-PLATAFORMA.md §11: "orçamento sem valor visível é assinatura em branco" — o total
 * aparece antes de qualquer botão de decisão, nunca escondido atrás de um clique. A
 * `Referrer-Policy: strict-origin-when-cross-origin` do middleware global já cobre o cuidado do
 * plano com o token vazar em header de clique externo — cross-origin só recebe origem, nunca o
 * path com o token (registrado em docs/DECISOES.md); esta página não precisa de override.
 */
export default function Orcamento({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [dados, setDados] = useState<Dados | null>(null)
  const [mensagemErro, setMensagemErro] = useState('')
  const [motivoRecusa, setMotivoRecusa] = useState('')
  /**
   * A falha foi transitória (5xx, rede) ou o servidor recusou o token? A tela tratava as duas
   * igual e não oferecia saída nenhuma — e aqui o custo é o mais alto das quatro telas públicas:
   * quem cai neste estado estava aprovando um orçamento, ou seja, fechando negócio.
   */
  const [podeTentarDeNovo, setPodeTentarDeNovo] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  /** Recarrega o orçamento em vez de repetir aprovar/recusar: a decisão volta para ela. */
  function tentarDeNovo() {
    setEstado('carregando')
    setPodeTentarDeNovo(false)
    setTentativa((n) => n + 1)
  }

  useEffect(() => {
    fetch(`/api/v1/public/quotes/${token}`)
      .then(async (r) => {
        const json = (await r.json()) as { data?: Dados; error?: { message: string } }
        if (!r.ok || !json.data) {
          setMensagemErro(json.error?.message ?? 'Não encontramos esse orçamento.')
          setPodeTentarDeNovo(r.status >= 500)
          setEstado('erro')
          return
        }
        setDados(json.data)
        setEstado(json.data.status === 'approved' ? 'aprovado' : json.data.status === 'rejected' ? 'recusado' : 'pronto')
      })
      .catch(() => {
        setMensagemErro('Não consegui falar com o servidor.')
        setPodeTentarDeNovo(true)
        setEstado('erro')
      })
  }, [token, tentativa])

  function aprovar() {
    setEstado('carregando')
    fetch(`/api/v1/public/quotes/${token}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(async (r) => {
        const json = (await r.json()) as { error?: { message: string } }
        if (!r.ok) {
          setMensagemErro(json.error?.message ?? 'Não consegui aprovar esse orçamento.')
          setPodeTentarDeNovo(r.status >= 500)
          setEstado('erro')
          return
        }
        setEstado('aprovado')
      })
      .catch(() => {
        setMensagemErro('Não consegui falar com o servidor.')
        setPodeTentarDeNovo(true)
        setEstado('erro')
      })
  }

  function recusar() {
    setEstado('carregando')
    fetch(`/api/v1/public/quotes/${token}/reject`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: motivoRecusa.trim() || null }),
    })
      .then(async (r) => {
        const json = (await r.json()) as { error?: { message: string } }
        if (!r.ok) {
          setMensagemErro(json.error?.message ?? 'Não consegui recusar esse orçamento.')
          setPodeTentarDeNovo(r.status >= 500)
          setEstado('erro')
          return
        }
        setEstado('recusado')
      })
      .catch(() => {
        setMensagemErro('Não consegui falar com o servidor.')
        setPodeTentarDeNovo(true)
        setEstado('erro')
      })
  }

  const tela = telaDoOrcamento(estado, dados !== null)

  // O ERRO VEM PRIMEIRO, e a ordem é a correção inteira: erro é o caso em que `dados` é `null`,
  // então qualquer ramo com `!dados` acima deste o engole — foi assim que a tela ficou em
  // "Carregando…" para sempre com token inválido.
  if (tela === 'erro') {
    return (
      <ErroPublico
        titulo="Não deu certo"
        mensagem={mensagemErro}
        {...(podeTentarDeNovo ? { aoTentarDeNovo: tentarDeNovo } : {})}
      />
    )
  }

  // `|| !dados` aqui é só estreitamento de tipo para o resto da função — a decisão já foi tomada
  // por `telaDoOrcamento`, e o ramo de erro já saiu acima.
  if (tela === 'carregando' || !dados) {
    return <p className="text-corpo text-txt-2">Carregando orçamento…</p>
  }

  if (dados.status === 'expired') {
    return (
      <>
        <Clock aria-hidden className="mb-4 size-14 text-txt-3" />
        <h1 className="text-titulo font-bold">Orçamento vencido</h1>
        <p className="mt-2 text-corpo text-txt-2">Esse orçamento não vale mais. Fale com {dados.businessName} pra pedir um novo.</p>
      </>
    )
  }

  if (estado === 'aprovado') {
    return (
      <>
        <CheckCircle2 aria-hidden className="mb-4 size-14 text-ok" />
        <h1 className="text-titulo font-bold">Orçamento aprovado</h1>
        <p className="mt-2 text-corpo text-txt-2">{dados.businessName} já foi avisado. Combine o horário por lá.</p>
      </>
    )
  }

  if (estado === 'recusado') {
    return (
      <>
        <FileX aria-hidden className="mb-4 size-14 text-txt-3" />
        <h1 className="text-titulo font-bold">Orçamento recusado</h1>
        <p className="mt-2 text-corpo text-txt-2">Tudo bem, {dados.businessName} foi avisado.</p>
      </>
    )
  }

  return (
    <div className="w-full text-left">
      <p className="text-center text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">{dados.businessName}</p>
      <h1 className="mt-1 text-center text-titulo font-bold">Orçamento</h1>

      <Card className="mt-5 flex flex-col gap-2">
        {dados.items.map((item, i) => (
          <div key={i} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-corpo text-txt">{item.description}</p>
              {item.qty !== 1 ? <p className="text-secundario text-txt-3">{item.qty}×</p> : null}
            </div>
            <p className="tabular shrink-0 text-corpo text-txt-2">{dinheiro.format(item.totalCents / 100)}</p>
          </div>
        ))}
      </Card>

      <Card className="mt-3 flex items-center justify-between">
        <span className="text-corpo font-semibold text-txt-2">Total</span>
        <span className="tabular text-titulo font-bold text-acc-2">{dinheiro.format(dados.totalCents / 100)}</span>
      </Card>

      {dados.message ? <p className="mt-3 whitespace-pre-line text-corpo text-txt-2">{dados.message}</p> : null}
      {dados.validUntil ? (
        <p className="mt-2 text-secundario text-txt-3">
          Vale até {new Date(`${dados.validUntil}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
        </p>
      ) : null}

      {estado === 'recusando' ? (
        <div className="mt-5 flex flex-col gap-2.5">
          <Textarea rotulo="Por quê? (opcional)" value={motivoRecusa} onChange={(e) => setMotivoRecusa(e.target.value)} />
          <Button largura="cheia" variante="secondary" onClick={recusar}>
            Confirmar recusa
          </Button>
          <Button largura="cheia" variante="secondary" onClick={() => setEstado('pronto')}>
            Voltar
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-2.5">
          <Button largura="cheia" onClick={aprovar}>
            Aprovar orçamento
          </Button>
          <Button largura="cheia" variante="secondary" onClick={() => setEstado('recusando')}>
            Recusar
          </Button>
        </div>
      )}
    </div>
  )
}
