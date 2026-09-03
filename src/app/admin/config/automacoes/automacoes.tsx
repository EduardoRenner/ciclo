'use client'

import { Check, Lock, Play, Pause } from 'lucide-react'
import { useState } from 'react'

import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  EXPLICACAO_DO_NIVEL,
  NOME_DO_NIVEL,
  niveisDisponiveis,
  rodaDeVerdade,
  type Automacao,
  type NivelAutonomia,
} from '@/core/automacoes/catalogo'
import type { ConfigAutomacoes } from '@/core/automacoes/config'
import { cn } from '@/lib/utils'

/**
 * O dial do `docs/33 §3.1`, na tela. Três decisões do plano que o componente faz valer:
 *
 * 1. **Nível que a automação não alcança nem aparece** (`§3.1`) — `niveisDisponiveis` corta pelo
 *    teto do catálogo. Dial com posição que nada alcança é promessa vazia, a mesma classe do
 *    quadro "Taxa" sempre zerado que a auditoria desta base já pegou.
 * 2. **Desligar/baixar é instantâneo** (`§3.3`) — o clique aplica otimista e só volta atrás se o
 *    servidor recusar. Na rede de um salão, esperar o servidor para o botão mexer faz a pessoa
 *    tocar de novo achando que não pegou.
 * 3. **"Você escolheu" ≠ "o produto consegue"** — o selo de estado real vem de `rodaDeVerdade`,
 *    que lê `ROTAS_AGENDADAS`. É o que impede esta tela de repetir a mentira que a de mensagens
 *    contava.
 */
export default function Automacoes({ automacoes, config }: { automacoes: Automacao[]; config: ConfigAutomacoes }) {
  const mostrarToast = useToast()
  const [niveis, setNiveis] = useState<ConfigAutomacoes>(config)
  const [salvando, setSalvando] = useState<string | null>(null)

  async function trocar(a: Automacao, nivel: NivelAutonomia) {
    if (a.sempreLigada || niveis[a.chave] === nivel) return

    const anterior = niveis[a.chave]
    setNiveis((n) => ({ ...n, [a.chave]: nivel }))
    setSalvando(a.chave)

    try {
      const r = await fetch('/api/v1/tenant/automacoes', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ chave: a.chave, nivel }),
      })
      if (!r.ok) {
        setNiveis((n) => ({ ...n, [a.chave]: anterior }))
        const json = (await r.json().catch(() => null)) as { error?: { message?: string } } | null
        mostrarToast({ tom: 'erro', titulo: json?.error?.message ?? 'Não deu para salvar agora.' })
      }
    } catch {
      setNiveis((n) => ({ ...n, [a.chave]: anterior }))
      mostrarToast({ tom: 'erro', titulo: 'Sem conexão agora. O que você mudou não foi salvo.' })
    } finally {
      setSalvando(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-8">
      {automacoes.map((a) => {
        const nivel = niveis[a.chave]
        const opcoes = niveisDisponiveis(a)
        const roda = rodaDeVerdade(a)

        return (
          <Card key={a.chave} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-corpo font-semibold text-txt">{a.nome}</p>
                <p className="mt-0.5 text-secundario text-txt-2">{a.descricao}</p>
              </div>
              {/*
                O selo diz o que ACONTECE, não o que foi escolhido. Uma automação pode estar no
                nível que o dono quis e mesmo assim estar parada — e é isso que o dono precisa
                enxergar antes de esperar por uma mensagem que não vai sair.
              */}
              <span
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] px-2 py-1 text-label font-semibold',
                  roda ? 'bg-ok/15 text-ok' : 'bg-surface-2 text-txt-3',
                )}
              >
                {roda ? <Play aria-hidden className="size-3" /> : <Pause aria-hidden className="size-3" />}
                {roda ? 'Ativa' : 'Parada'}
              </span>
            </div>

            {!roda ? (
              <p className="text-secundario text-txt-3">
                Está pronta, mas ainda não roda sozinha: falta ligar o envio no WhatsApp. Enquanto isso, ela aparece
                para você resolver na mão.
              </p>
            ) : null}

            {a.sempreLigada ? (
              <p className="flex items-center gap-1.5 text-secundario text-txt-3">
                <Lock aria-hidden className="size-3.5 shrink-0" />
                Faz parte do produto: {a.motivoDoTeto}
              </p>
            ) : (
              <>
                <div role="group" aria-label={`Nível de ${a.nome}`} className="grid gap-1.5">
                  {opcoes.map((n) => {
                    const ligado = nivel === n
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => trocar(a, n)}
                        aria-pressed={ligado}
                        disabled={salvando === a.chave}
                        className={cn(
                          'flex min-h-12 items-center gap-2.5 rounded-[var(--radius-sm)] border px-3 py-2 text-left transition',
                          ligado ? 'border-acc-2 bg-acc-soft' : 'border-line hover:border-line-2 hover:bg-surface-2',
                          salvando === a.chave && 'opacity-60',
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-4 shrink-0 place-items-center rounded-full border',
                            ligado ? 'border-acc-2 bg-acc text-on-acc' : 'border-line-2',
                          )}
                        >
                          {ligado ? <Check aria-hidden className="size-2.5" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-corpo font-semibold text-txt">{NOME_DO_NIVEL[n]}</span>
                          <span className="block text-secundario text-txt-2">{EXPLICACAO_DO_NIVEL[n]}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                {/*
                  O teto não é escondido: quando o dial para antes do 3, a tela DIZ por quê. Sem
                  isso o dono acha que é limitação de plano e vai procurar upgrade que não existe.
                */}
                {a.nivelMaximo < 3 && a.motivoDoTeto ? (
                  <p className="flex items-start gap-1.5 text-secundario text-txt-3">
                    <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    Não vai além daqui: {a.motivoDoTeto}
                  </p>
                ) : null}
              </>
            )}
          </Card>
        )
      })}
    </div>
  )
}
