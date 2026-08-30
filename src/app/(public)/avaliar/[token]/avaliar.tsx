'use client'

import { CheckCircle2, Gift, Star, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { linkWhatsAppCompartilhar } from '@/lib/mensagens'

type Estado = 'carregando' | 'pronto' | 'enviando' | 'enviado' | 'erro'
type Dados = { negocioNome: string; servicoNome: string; jaAvaliado: boolean }

export default function Avaliar({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [dados, setDados] = useState<Dados | null>(null)
  const [nota, setNota] = useState(0)
  const [notaEmFoco, setNotaEmFoco] = useState(0)
  const [comentario, setComentario] = useState('')
  const [mensagem, setMensagem] = useState('')
  // I-3, `docs/30-INDICACAO-PLANO.md` §2.5/§4.4: só existe quando a nota foi 4 ou 5 — é o pico.
  const [linkIndicacao, setLinkIndicacao] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    fetch(`/api/v1/public/reviews/${token}`)
      .then(async (r) => {
        const json = (await r.json()) as { data?: Dados; error?: { message: string } }
        if (cancelado) return
        if (!r.ok || !json.data) {
          setEstado('erro')
          setMensagem(json.error?.message ?? 'Esse link de avaliação não é mais válido.')
          return
        }
        setDados(json.data)
        setEstado(json.data.jaAvaliado ? 'enviado' : 'pronto')
      })
      .catch(() => {
        if (!cancelado) {
          setEstado('erro')
          setMensagem('Não consegui falar com o servidor. Tente de novo em instantes.')
        }
      })
    return () => {
      cancelado = true
    }
  }, [token])

  function enviar() {
    if (nota === 0) return
    setEstado('enviando')
    fetch(`/api/v1/public/reviews/${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating: nota, comment: comentario.trim() || null }),
    })
      .then(async (r) => {
        const json = (await r.json()) as { error?: { message: string }; data?: { referralLink: string | null } }
        if (!r.ok) {
          setEstado('erro')
          setMensagem(json.error?.message ?? 'Não consegui registrar sua avaliação.')
          return
        }
        setLinkIndicacao(json.data?.referralLink ?? null)
        setEstado('enviado')
      })
      .catch(() => {
        setEstado('erro')
        setMensagem('Não consegui falar com o servidor. Tente de novo em instantes.')
      })
  }

  if (estado === 'carregando') {
    return <p className="text-corpo text-txt-2">Carregando…</p>
  }

  if (estado === 'erro') {
    return (
      <>
        <XCircle aria-hidden className="mb-4 size-14 text-bad" />
        <p className="text-titulo font-bold">Não consegui abrir</p>
        <p className="mt-2 text-corpo text-txt-2">{mensagem}</p>
      </>
    )
  }

  if (estado === 'enviado') {
    /*
     * I-3, `docs/30-INDICACAO-PLANO.md` §2.2/§4.3: moldura de PRESENTE, não de venda — "indique
     * e ganhe" faz quem indica se sentir vendendo a própria amiga (a pesquisa mostra que é
     * exatamente isso que trava 83% dos clientes satisfeitos de indicar). A copy não promete
     * valor em reais: `docs/30` §9 deixou em aberto QUAL prêmio e QUANTO — inventar um número
     * aqui seria a mesma classe de promessa vazia que o achado do quadro "Taxa" (rodada 1 da
     * auditoria) já pegou uma vez nesta base. O que é verdadeiro hoje, em qualquer plano, é isto:
     * o link chega marcado, e o salão sabe que foi esta cliente quem trouxe a amiga.
     */
    const mensagemCompartilhar = dados?.negocioNome
      ? `Oi! Super recomendo a ${dados.negocioNome}. Marca seu primeiro horário por aqui: ${linkIndicacao}`
      : `Oi! Super recomendo esse lugar. Marca seu primeiro horário por aqui: ${linkIndicacao}`

    return (
      <>
        <CheckCircle2 aria-hidden className="mb-4 size-14 text-ok" />
        <p className="text-titulo font-bold">Obrigado pela avaliação!</p>
        <p className="mt-2 text-corpo text-txt-2">
          {dados?.negocioNome ? `A equipe da ${dados.negocioNome} agradece.` : 'Sua opinião ajuda o negócio a melhorar.'}
        </p>

        {linkIndicacao ? (
          <Card className="mt-6 w-full text-left">
            <div className="flex items-start gap-3">
              <Gift aria-hidden className="mt-0.5 size-5 shrink-0 text-acc-2" />
              <div className="flex-1">
                <p className="text-corpo font-semibold text-txt">Indique uma amiga</p>
                <p className="mt-1 text-secundario text-txt-2">
                  Ela agenda o primeiro horário sem esperar resposta — e {dados?.negocioNome ?? 'o salão'} fica sabendo que foi você.
                </p>
              </div>
            </div>
            {/* `<a>`, não `Button` — `Button` renderiza `<button>`, e botão dentro de link é
                conteúdo interativo aninhado (mesmo padrão de `orcamentos/novo/formulario.tsx`). */}
            <a
              href={linkWhatsAppCompartilhar(mensagemCompartilhar)}
              target="_blank"
              rel="noopener noreferrer"
              className="toque-48 mt-4 flex items-center justify-center rounded-[var(--radius-pill)] bg-acc px-5 text-corpo font-semibold text-on-acc"
            >
              Mandar no WhatsApp
            </a>
          </Card>
        ) : null}
      </>
    )
  }

  return (
    <>
      <p className="text-titulo font-bold">Como foi seu {dados?.servicoNome ?? 'atendimento'}?</p>
      <p className="mt-1 text-secundario text-txt-2">{dados?.negocioNome}</p>

      <div className="mt-6 flex gap-1" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
        {[1, 2, 3, 4, 5].map((valor) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={nota === valor}
            aria-label={`${valor} ${valor === 1 ? 'estrela' : 'estrelas'}`}
            onClick={() => setNota(valor)}
            onMouseEnter={() => setNotaEmFoco(valor)}
            onMouseLeave={() => setNotaEmFoco(0)}
            className="grid size-12 place-items-center"
          >
            <Star
              aria-hidden
              className={`size-9 transition-colors ${
                valor <= (notaEmFoco || nota) ? 'fill-warn text-warn' : 'text-line-2'
              }`}
            />
          </button>
        ))}
      </div>

      {nota > 0 ? (
        /*
          O placeholder era o único rótulo do campo — §7 do design system pede
          `<label>` de verdade, e placeholder some no primeiro caractere: quem
          usa leitor de tela ouvia só "caixa de texto", e quem digitou perde a
          pergunta de vista.
        */
        <label className="mt-4 flex w-full flex-col gap-1 text-left">
          <span className="text-label font-semibold text-txt-2">Quer contar mais alguma coisa?</span>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            placeholder="Opcional"
            className="w-full rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 py-2 text-corpo text-txt"
          />
        </label>
      ) : null}

      {/*
        Era um `<button>` cru, fora do design system, desabilitado enquanto a
        nota fosse 0 e sem dizer por quê: no leitor de tela dava "Enviar
        avaliação, indisponível" e ponto. `Button` já resolve as duas coisas —
        `motivoDesabilitado` vira `title` e texto de leitor, e `carregando` põe
        o spinner dentro do próprio botão.
      */}
      <Button
        largura="cheia"
        className="mt-4"
        onClick={enviar}
        carregando={estado === 'enviando'}
        disabled={nota === 0}
        motivoDesabilitado="Escolha de 1 a 5 estrelas para poder enviar."
      >
        Enviar avaliação
      </Button>
    </>
  )
}
