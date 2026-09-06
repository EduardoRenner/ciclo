'use client'

import { useState, useTransition } from 'react'

import AlertBanner from '@/components/ui/alert-banner'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { FORMAS_DE_PAGAMENTO, NOME_DA_FORMA, type FormaDePagamento, type TaxasDePagamento } from '@/core/comanda/taxa-de-pagamento'

/** O dono sabe "três e meio por cento", não "350 basis points". A conversão mora aqui, na borda. */
function bpsParaPercentual(valor: number): string {
  return String(valor / 100)
}

function percentualParaBps(texto: string): number {
  const numero = Number(texto.replace(',', '.'))
  if (!Number.isFinite(numero) || numero < 0) return 0
  return Math.min(10_000, Math.round(numero * 100))
}

/**
 * A tela que faltava para `tickets.fee_cents` deixar de ser uma coluna que ninguém escreve
 * (`docs/49`). Sem ela, o "Sobrou" do caixa é faturamento menos material e comissão — e o salão
 * que passa a maior parte no cartão fecha o mês achando que sobrou mais do que sobrou.
 */
export default function EditorTaxas({ inicial, respondida }: { inicial: TaxasDePagamento; respondida: boolean }) {
  const mostrarToast = useToast()
  const [pendente, iniciarTransicao] = useTransition()
  const [valores, setValores] = useState<Record<FormaDePagamento, string>>(() =>
    Object.fromEntries(FORMAS_DE_PAGAMENTO.map((f) => [f, bpsParaPercentual(inicial[f])])) as Record<FormaDePagamento, string>,
  )
  const [erro, setErro] = useState<string | null>(null)
  const [jaSalvou, setJaSalvou] = useState(respondida)

  function salvar() {
    setErro(null)
    iniciarTransicao(async () => {
      try {
        const corpo = Object.fromEntries(FORMAS_DE_PAGAMENTO.map((f) => [f, percentualParaBps(valores[f])]))
        const r = await fetch('/api/v1/tenant/payment-fees', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify(corpo),
        })
        const json = (await r.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
        if (!r.ok) {
          const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
          setErro(campo ?? json.error?.message ?? 'Não consegui salvar.')
          return
        }
        setJaSalvou(true)
        mostrarToast({ tom: 'ok', titulo: 'Taxa salva' })
      } catch {
        // Sem este `catch`, o React 19 relança para o error boundary da raiz e a tela some
        // levando o que a pessoa digitou (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  return (
    <Card>
      {jaSalvou ? null : (
        <AlertBanner tom="warn" className="mb-3">
          <p className="text-secundario">
            Enquanto você não disser quanto a máquina cobra, o CICLO calcula o que sobrou <strong>sem descontar a maquininha</strong> — e
            o número fica maior do que a verdade. Se você só recebe em dinheiro e Pix, deixe tudo em zero e salve mesmo assim.
          </p>
        </AlertBanner>
      )}

      <p className="text-corpo font-semibold">Quanto a máquina fica</p>
      <p className="mt-1 text-secundario text-txt-2">
        Está na fatura da sua adquirente, por forma de pagamento. Vale a partir da próxima comanda fechada; as antigas não mudam.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {FORMAS_DE_PAGAMENTO.map((forma) => (
          <label key={forma} className="flex items-center justify-between gap-3">
            <span className="text-corpo text-txt">{NOME_DA_FORMA[forma]}</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                value={valores[forma]}
                onChange={(e) => setValores((atual) => ({ ...atual, [forma]: e.target.value }))}
                aria-label={`Taxa de ${NOME_DA_FORMA[forma]}, em porcentagem`}
                className="h-12 w-24 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-right text-corpo tabular text-txt"
              />
              <span aria-hidden className="text-corpo text-txt-2">
                %
              </span>
            </span>
          </label>
        ))}
      </div>

      {erro ? (
        <p role="alert" className="mt-3 text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      <Button className="mt-4" largura="cheia" carregando={pendente} onClick={salvar}>
        Salvar
      </Button>
    </Card>
  )
}
