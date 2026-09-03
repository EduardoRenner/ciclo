'use client'

import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

import type { ConfigFidelidade } from '@/server/services/fidelidade'

/**
 * O que transforma fidelidade de "botão que a profissional lembra de apertar" em automação:
 * essa config decide quantos pontos cada real vira, sozinho, quando o atendimento é concluído
 * (`pontuarAtendimentoConcluido`, chamada de dentro de `concluirAgendamento`).
 */
export default function EditorFidelidade({
  inicial,
  bloqueado = false,
}: {
  inicial: ConfigFidelidade
  /** `loyalty` fora do degrau. A oferta completa está na página; aqui trava o Salvar. */
  bloqueado?: boolean
}) {
  const mostrarToast = useToast()
  const [pendente, iniciarTransicao] = useTransition()

  const [pointsPerReal, setPointsPerReal] = useState(String(inicial.pointsPerReal))
  const [referralBonusPoints, setReferralBonusPoints] = useState(String(inicial.referralBonusPoints))
  const [rewardThreshold, setRewardThreshold] = useState(String(inicial.rewardThreshold))
  const [rewardLabel, setRewardLabel] = useState(inicial.rewardLabel ?? '')
  const [erro, setErro] = useState<string | null>(null)

  function salvar() {
    setErro(null)
    iniciarTransicao(async () => {
      try {
        const r = await fetch('/api/v1/tenant/loyalty-config', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({
            pointsPerReal: Number(pointsPerReal) || 0,
            referralBonusPoints: Number(referralBonusPoints) || 0,
            rewardThreshold: Number(rewardThreshold) || 100,
            rewardLabel: rewardLabel.trim() || null,
          }),
        })
        const json = (await r.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
        if (!r.ok) {
          const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
          setErro(campo ?? json.error?.message ?? 'Não consegui salvar.')
          return
        }
        mostrarToast({ tom: 'ok', titulo: 'Fidelidade atualizada' })
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  return (
    <Card>
      <p className="text-corpo font-semibold">Como pontuar automaticamente</p>
      <p className="mt-1 text-secundario text-txt-2">
        A cada atendimento concluído, o cliente ganha pontos sozinho — sem ninguém precisar lançar na mão.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Pontos por real gasto</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={pointsPerReal}
            onChange={(e) => setPointsPerReal(e.target.value)}
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Bônus por indicação</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={referralBonusPoints}
            onChange={(e) => setReferralBonusPoints(e.target.value)}
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
          />
        </label>
      </div>
      <p className="mt-1.5 text-label text-txt-3">
        Pontos por real: 0 desliga a pontuação automática. Bônus por indicação: dado aos dois lados quando o indicado
        conclui a primeira visita.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Pontos até o prêmio</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={rewardThreshold}
            onChange={(e) => setRewardThreshold(e.target.value)}
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Nome do prêmio</span>
          <input
            value={rewardLabel}
            onChange={(e) => setRewardLabel(e.target.value)}
            placeholder="Corte grátis"
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
          />
        </label>
      </div>

      {erro ? (
        <p role="alert" className="mt-2 text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      <Button
        largura="cheia"
        carregando={pendente}
        disabled={bloqueado}
        motivoDesabilitado="Pontos automáticos são do plano Equipe. Veja o caminho no aviso acima desta tela."
        onClick={salvar}
        className="mt-3"
      >
        Salvar
      </Button>
    </Card>
  )
}
