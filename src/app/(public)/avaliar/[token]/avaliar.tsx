'use client'

import { CheckCircle2, Star, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import Button from '@/components/ui/button'

type Estado = 'carregando' | 'pronto' | 'enviando' | 'enviado' | 'erro'
type Dados = { negocioNome: string; servicoNome: string; jaAvaliado: boolean }

export default function Avaliar({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [dados, setDados] = useState<Dados | null>(null)
  const [nota, setNota] = useState(0)
  const [notaEmFoco, setNotaEmFoco] = useState(0)
  const [comentario, setComentario] = useState('')
  const [mensagem, setMensagem] = useState('')

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
        const json = (await r.json()) as { error?: { message: string } }
        if (!r.ok) {
          setEstado('erro')
          setMensagem(json.error?.message ?? 'Não consegui registrar sua avaliação.')
          return
        }
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
    return (
      <>
        <CheckCircle2 aria-hidden className="mb-4 size-14 text-ok" />
        <p className="text-titulo font-bold">Obrigado pela avaliação!</p>
        <p className="mt-2 text-corpo text-txt-2">
          {dados?.negocioNome ? `A equipe da ${dados.negocioNome} agradece.` : 'Sua opinião ajuda o negócio a melhorar.'}
        </p>
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
