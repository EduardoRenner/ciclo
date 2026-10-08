'use client'

import { MessageCircle, Phone } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Badge from '@/components/ui/badge'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Textarea from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { acoesDaTela, type GrupoDaFila } from '@/core/advocacia/fila-de-pendencias'
import AtalhosDaFila from '@/components/advocacia/atalhos-da-fila'
import { escreverJuridico } from '@/lib/advocacia/escrever'

type Acao = ReturnType<typeof acoesDaTela>[number]

const ROTULO: Record<Acao, string> = {
  aprovar: 'Aprovar',
  receber: 'Recebi',
  concluir: 'Conferi',
  devolver: 'Devolver',
}

const FEITO: Record<Acao, string> = {
  aprovar: 'Pendência aprovada',
  receber: 'Marcada como recebida',
  concluir: 'Pendência concluída',
  devolver: 'Devolvida ao cliente',
}

// Sem o tom `info`: o ícone dele é um cadeado, que no pacote quer dizer sigilo.
const ESTADO: Record<string, { texto: string; tom: 'ok' | 'warn' | 'risk' | 'ciclo' }> = {
  rascunho: { texto: 'Rascunho', tom: 'ciclo' },
  pendente: { texto: 'Aguardando', tom: 'warn' },
  devolvido: { texto: 'Devolvida', tom: 'risk' },
  recebido: { texto: 'Recebida', tom: 'ok' },
  em_conferencia: { texto: 'Em conferência', tom: 'ok' },
}

/** Itens visíveis por cliente antes do "Ver mais": o cartão de uma família não empurra a fila inteira. */
const VISIVEIS = 3

const dataCurta = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })

/**
 * docs/101 T2.7: a fila do botão central. Cada cliente é um cartão; "Cobrar" abre o WhatsApp com o
 * texto pronto (nada sai sozinho); "Recebi", "Conferi" e "Devolver" mudam o estado pela API, com a
 * versão que a tela leu (outra pessoa mexeu antes: 409 e a tela recarrega).
 */
export default function FilaDePendencias({ grupos }: { grupos: GrupoDaFila[] }) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [pendente, iniciar] = useTransition()
  const [devolvendo, setDevolvendo] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<{ id: string; texto: string } | null>(null)
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set())

  /** Marca o lembrete (sem esperar): a mensagem já saiu pelo WhatsApp, e uma falha aqui só faz a fila pedir de novo. */
  function registrar(itens: string[], marco: 0 | 3 | 7 | 'ligar') {
    void escreverJuridico('/api/v1/legal/checklist/lembrete', { method: 'POST', json: { itens, marco } }).then((r) => {
      if (r.ok) router.refresh()
    })
  }

  function agir(id: string, rowVersion: number, acao: Acao, motivoDaAcao?: string) {
    setErro(null)
    iniciar(async () => {
      // `escreverJuridico` não lança: rede caída vira frase, e o React 19 não leva a fila para o boundary.
      const r = await escreverJuridico(`/api/v1/legal/checklist/${id}`, { method: 'PATCH', json: { acao, rowVersion, ...(motivoDaAcao ? { motivo: motivoDaAcao } : {}) } })
      if (!r.ok) {
        setErro({ id, texto: r.texto })
        if (r.tipo === 'conflito') router.refresh()
        return
      }
      mostrarToast({ tom: 'ok', titulo: FEITO[acao] })
      setDevolvendo(null)
      setMotivo('')
      router.refresh()
    })
  }

  return (
    <AtalhosDaFila modo="agir">
    <ul aria-busy={pendente} className="flex flex-col gap-3">
      {grupos.map((g) => (
        <li key={g.clienteId}>
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/clientes/${g.clienteId}`} className="text-corpo font-semibold underline-offset-2 hover:underline">
                  {g.clienteNome}
                </Link>
                <p className="text-secundario text-txt-2">
                  {g.itens.length} {g.itens.length === 1 ? 'pendência' : 'pendências'}
                  {g.diasEmAberto > 0 ? ` · a mais antiga há ${g.diasEmAberto} ${g.diasEmAberto === 1 ? 'dia' : 'dias'}` : ' · aberta hoje'}
                </p>
              </div>
              {g.atrasados > 0 ? <Badge estado="risk" className="shrink-0 whitespace-nowrap">{g.atrasados === 1 ? '1 atrasada' : `${g.atrasados} atrasadas`}</Badge> : null}
            </div>

            {g.lembrete ? (
              <p role="status" className="text-secundario font-semibold text-warn">
                {g.lembrete.tipo === 'ligar'
                  ? 'Passou de 10 dias sem resposta: vale ligar.'
                  : g.lembrete.marco === 0
                    ? 'Dia de avisar o que falta.'
                    : `Dia de lembrar: ${g.lembrete.marco} dias sem resposta.`}
              </p>
            ) : null}
            {g.lembrete?.tipo === 'ligar' && g.telefone ? (
              <div className="flex flex-wrap gap-2">
                <a
                  href={`tel:${g.telefone}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold"
                >
                  <Phone aria-hidden className="size-5" />
                  Ligar
                </a>
                <Button variante="ghost" onClick={() => registrar(g.lembrete!.itens, 'ligar')}>
                  Liguei
                </Button>
              </div>
            ) : null}
            {g.cobranca && 'link' in g.cobranca ? (
              <a
                href={g.cobranca.link}
                target="_blank"
                rel="noopener noreferrer"
                // o toque em Cobrar é o "cobrei": marca o marco da escada para a fila não pedir de novo hoje
                onClick={() => {
                  if (g.lembrete?.tipo === 'mensagem') registrar(g.lembrete.itens, g.lembrete.marco as 0 | 3 | 7)
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc"
              >
                <MessageCircle aria-hidden className="size-5" />
                Cobrar pelo WhatsApp
              </a>
            ) : g.cobranca && 'erro' in g.cobranca ? (
              <p role="note" className="text-secundario text-warn">
                {g.cobranca.erro}
              </p>
            ) : null}

            <ul className="flex flex-col divide-y divide-line">
              {(abertos.has(g.clienteId) ? g.itens : g.itens.slice(0, VISIVEIS)).map((i) => {
                const estado = ESTADO[i.estado]
                return (
                  <li key={i.id} tabIndex={-1} data-atalho-item aria-keyshortcuts="j k" className="flex flex-col gap-2 rounded-[var(--radius-sm)] py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-corpo">{i.titulo}</p>
                        <p className="text-label text-txt-3">
                          {i.casoTitulo}
                          {i.quemDeve === 'equipe' ? ' · com a equipe' : ''}
                          {i.venceEm ? ` · até ${dataCurta(i.venceEm)}` : ''}
                          {i.rodada > 1 ? ` · ${i.rodada}ª rodada` : ''}
                        </p>
                        {i.estado === 'devolvido' && i.motivoDaDevolucao ? (
                          <p className="mt-1 text-secundario text-txt-2">Devolvida: {i.motivoDaDevolucao}</p>
                        ) : null}
                      </div>
                      {i.atrasado ? <Badge estado="risk">Atrasada</Badge> : estado ? <Badge estado={estado.tom}>{estado.texto}</Badge> : null}
                    </div>

                    {devolvendo === i.id ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          rotulo="O que precisa ser corrigido"
                          ajuda="Fica no histórico da pendência e abre uma nova rodada de lembretes."
                          rows={2}
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          maxLength={500}
                        />
                        <div className="flex gap-2">
                          <Button
                            tamanho="sm"
                            variante="danger"
                            disabled={motivo.trim().length < 5}
                            motivoDesabilitado="Escreva o motivo com pelo menos 5 letras."
                            carregando={pendente}
                            onClick={() => agir(i.id, i.rowVersion, 'devolver', motivo)}
                          >
                            Devolver
                          </Button>
                          <Button tamanho="sm" variante="ghost" onClick={() => setDevolvendo(null)}>
                            Voltar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {acoesDaTela(i.estado, i.quemDeve).map((a, n) => (
                          <Button
                            key={a}
                            {...(n === 0 && a !== 'devolver' ? { 'data-atalho-acao': true, 'aria-keyshortcuts': 'c' } : {})}
                            tamanho="sm"
                            variante={a === 'devolver' ? 'ghost' : 'secondary'}
                            disabled={pendente}
                            motivoDesabilitado="Salvando a ação anterior."
                            onClick={() => (a === 'devolver' ? (setDevolvendo(i.id), setMotivo('')) : agir(i.id, i.rowVersion, a))}
                          >
                            {ROTULO[a]}
                          </Button>
                        ))}
                      </div>
                    )}
                    {erro?.id === i.id ? (
                      <p role="alert" className="text-secundario text-bad">
                        {erro.texto}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {g.itens.length > VISIVEIS && !abertos.has(g.clienteId) ? (
              <Button tamanho="sm" variante="ghost" onClick={() => setAbertos((a) => new Set(a).add(g.clienteId))}>
                Ver mais {g.itens.length - VISIVEIS}
              </Button>
            ) : null}

          </Card>
        </li>
      ))}
    </ul>
    </AtalhosDaFila>
  )
}
