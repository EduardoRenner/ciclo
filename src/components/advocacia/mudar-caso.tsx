'use client'

import { MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Select from '@/components/ui/select'
import Textarea from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { ESTADOS_DO_CASO, podeMudarEstado, type EstadoDoCaso } from '@/core/advocacia/casos'
import { ROTULO_DO_ESTADO_DO_CASO } from '@/core/advocacia/resumo-do-caso'

type Props = { casoId: string; estado: EstadoDoCaso; rowVersion: number; notaAtual: string | null }

/**
 * docs/101 T2.6 e anexo 04 §4.4: mudar o estado do caso abre a pergunta "quer avisar o cliente?". A frase
 * vira a nota que o cliente lê e uma mensagem PRONTA de WhatsApp: o botão diz "Abrir no WhatsApp", nunca
 * "Enviar", porque quem envia é a pessoa (nada sai sozinho).
 */
export default function MudarCaso({ casoId, estado, rowVersion, notaAtual }: Props) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [pendente, iniciar] = useTransition()
  const [aberto, setAberto] = useState(false)
  const [novo, setNovo] = useState<EstadoDoCaso>(estado)
  const [frase, setFrase] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pronta, setPronta] = useState<{ link: string } | null>(null)
  const destinos = ESTADOS_DO_CASO.filter((e) => e === estado || podeMudarEstado(estado, e))

  function salvar() {
    setErro(null)
    iniciar(async () => {
      try {
        const r = await fetch(`/api/v1/legal/cases/${casoId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ ...(novo !== estado ? { estado: novo } : {}), ...(frase.trim() ? { notaParaCliente: frase.trim() } : {}), rowVersion }),
        })
        const json = (await r.json().catch(() => ({}))) as {
          data?: { mensagem: { link: string } | { erro: string } | null }
          error?: { message?: string; details?: { fields?: Record<string, string> } }
        }
        if (!r.ok || !json.data) {
          const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
          setErro(campo ?? json.error?.message ?? 'Não consegui salvar. Tente de novo.')
          if (r.status === 409) router.refresh()
          return
        }
        mostrarToast({ tom: 'ok', titulo: 'Caso atualizado' })
        const m = json.data.mensagem
        if (m && 'link' in m) setPronta({ link: m.link })
        else if (m && 'erro' in m) setErro(m.erro)
        else setAberto(false)
        setFrase('')
        router.refresh()
      } catch {
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  if (!aberto) {
    return (
      <Button tamanho="sm" variante="secondary" className="self-start" onClick={() => (setAberto(true), setNovo(estado), setPronta(null))}>
        Mudar estado ou avisar o cliente
      </Button>
    )
  }

  return (
    <Card className="flex flex-col gap-3 p-3" aria-busy={pendente}>
      <Select rotulo="Estado do caso" value={novo} onChange={(e) => setNovo(e.target.value as EstadoDoCaso)}>
        {destinos.map((e) => (
          <option key={e} value={e}>
            {ROTULO_DO_ESTADO_DO_CASO[e]}
          </option>
        ))}
      </Select>
      <Textarea
        rotulo="Quer avisar o cliente? Frase que vai na mensagem"
        ajuda={notaAtual ? `Última frase: “${notaAtual}”` : 'Sem número de processo, valor ou nome de outra parte. Opcional.'}
        rows={2}
        value={frase}
        onChange={(e) => setFrase(e.target.value)}
        maxLength={300}
      />
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      {pronta ? (
        <a
          href={pronta.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc"
        >
          <MessageCircle aria-hidden className="size-5" />
          Abrir no WhatsApp
        </a>
      ) : null}
      <div className="flex gap-2">
        <Button
          tamanho="sm"
          carregando={pendente}
          disabled={novo === estado && frase.trim().length < 2}
          motivoDesabilitado="Escolha outro estado ou escreva a frase ao cliente."
          onClick={salvar}
        >
          Salvar
        </Button>
        <Button tamanho="sm" variante="ghost" onClick={() => setAberto(false)}>
          Fechar
        </Button>
      </div>
    </Card>
  )
}
