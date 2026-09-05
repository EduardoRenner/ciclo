'use client'

import { CheckCircle2, MessageCircle } from 'lucide-react'

import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import PhoneInput from '@/components/ui/phone-input'
import Select from '@/components/ui/select'
import Textarea from '@/components/ui/textarea'

import { comMaiuscula, type Vocabulario } from '@/core/text/vocabulario'
import { linkWhatsApp } from '@/lib/mensagens'

type Servico = { id: string; name: string }

export default function PedidoDeOrcamento({
  slug,
  nomeDoSalao,
  whatsapp,
  servicos,
  vocabulario,
}: {
  slug: string
  nomeDoSalao: string
  whatsapp: string | null
  servicos: Servico[]
  vocabulario: Vocabulario
}) {
  const linkDoWhatsapp = linkWhatsApp(whatsapp, `Oi! Acabei de pedir um orçamento pelo site da ${nomeDoSalao}.`)
  const [mensagem, setMensagem] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [endereco, setEndereco] = useState('')
  // Honeypot: campo real no DOM, invisível só por posição. Mesmo contrato do agendamento público.
  const [website, setWebsite] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciarTransicao] = useTransition()

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    iniciarTransicao(async () => {
      try {
        const r = await fetch(`/api/v1/public/${slug}/quote-request`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({
            message: mensagem,
            name: nome,
            phone: telefone,
            serviceId: serviceId || null,
            address: endereco || null,
            website,
          }),
        })
        const json = (await r.json()) as { error?: { message: string } }
        if (!r.ok) {
          setErro(json.error?.message ?? 'Não consegui enviar seu pedido.')
          return
        }
        setEnviado(true)
      } catch {
        // `await fetch` sem `try` dentro de `useTransition` derruba a tela inteira no React 19 e
        // leva junto o que a pessoa escreveu — aqui isso seria o pedido todo.
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <CheckCircle2 aria-hidden className="size-12 text-ok" />
        <div>
          <p className="text-corpo font-semibold">Seu pedido chegou</p>
          {/*
            O que esta frase NÃO diz, e é o ponto: nada sobre receber mensagem. Não existe rota
            agendada que avise o salão de pedido novo, e prometer WhatsApp ou e-mail aqui é a
            armadilha mais cara do `CLAUDE.md` — quem fica mal é o salão, não o CICLO.

            O que ela diz é o que é verdade: está na lista de quem atende. E o botão abaixo dá o
            atalho para a pessoa cutucar por conta própria, em vez de esperar um aviso que ninguém
            programou.
          */}
          <p className="mt-1 text-secundario text-txt-2">
            Ele está na lista de {nomeDoSalao}. Se quiser adiantar, fale direto.
          </p>
        </div>
        {linkDoWhatsapp ? (
          <a
            href={linkDoWhatsapp}
            target="_blank"
            rel="noreferrer"
            className="toque-48 inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 py-3 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3"
          >
            <MessageCircle aria-hidden className="size-4" />
            Falar no WhatsApp
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Textarea
        rotulo="O que você precisa"
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        rows={4}
        placeholder="Conte o que precisa ser feito, o tamanho do lugar, se tem prazo…"
        required
      />

      {/*
        Opcional de propósito, e o rótulo diz isso: quem pede orçamento muitas vezes não sabe em
        qual serviço aquilo se encaixa, e um Select obrigatório faria a pessoa escolher errado só
        para o formulário aceitar.
      */}
      {servicos.length > 0 ? (
        <Select
          rotulo={`${comMaiuscula(vocabulario.servico)} (opcional)`}
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
        >
          <option value="">Não sei ainda</option>
          {servicos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      ) : null}

      <Input rotulo="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />

      <PhoneInput
        rotulo="Seu telefone"
        valor={telefone}
        aoMudar={setTelefone}
        ajuda="É por onde a resposta volta."
        required
      />

      {/* Mesmo rótulo do agendamento, e pelo mesmo motivo: "Endereço do atendimento" não sobrevive
          ao vocabulário da profissão, porque o artigo concorda com a palavra trocada. */}
      <Input
        rotulo="Onde vai ser (opcional)"
        value={endereco}
        onChange={(e) => setEndereco(e.target.value)}
        autoComplete="street-address"
      />

      {/* Honeypot: invisível para gente, visível para script. */}
      <label className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        Site
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      <Button type="submit" carregando={pendente}>
        Enviar pedido
      </Button>
    </form>
  )
}
