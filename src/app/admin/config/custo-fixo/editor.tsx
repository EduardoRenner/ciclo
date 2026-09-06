'use client'

import { useState, useTransition } from 'react'

import AlertBanner from '@/components/ui/alert-banner'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { custoPorHoraDaCadeira, type CustoFixoDoTenant } from '@/core/comanda/custo-fixo'

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** O dono digita "3500", não "350000". A conversão mora na borda, como na tela da taxa. */
function centavosParaReais(valor: number): string {
  return String(valor / 100)
}

function reaisParaCentavos(texto: string): number {
  const numero = Number(texto.replace(',', '.'))
  if (!Number.isFinite(numero) || numero < 0) return 0
  return Math.round(numero * 100)
}

function inteiro(texto: string, minimo: number): number {
  const numero = Number(texto.replace(',', '.'))
  if (!Number.isFinite(numero) || numero < minimo) return minimo
  return Math.round(numero)
}

/**
 * As três perguntas do custo fixo — a peça que faltava para o "Sobrou" ser lucro e não margem de
 * contribuição (`0072`).
 *
 * Nenhum campo é obrigatório no sentido de travar o uso: o dono pode salvar zero e seguir. O que
 * ele NÃO pode é ficar sem resposta e sem aviso — por isso a faixa de cima e a lacuna da comanda.
 */
export default function EditorCustoFixo({ inicial, respondido }: { inicial: CustoFixoDoTenant | null; respondido: boolean }) {
  const mostrarToast = useToast()
  const [pendente, iniciarTransicao] = useTransition()
  const [mensal, setMensal] = useState(centavosParaReais(inicial?.mensalCents ?? 0))
  // 260 = 9h às 19h de segunda a sábado, o expediente que `apply_vertical_pack` semeia.
  const [horas, setHoras] = useState(String(inicial?.horasPorMes ?? 260))
  const [cadeiras, setCadeiras] = useState(String(inicial?.cadeiras ?? 1))
  const [erro, setErro] = useState<string | null>(null)
  const [jaSalvou, setJaSalvou] = useState(respondido)

  const previa: CustoFixoDoTenant = {
    mensalCents: reaisParaCentavos(mensal),
    horasPorMes: Math.max(1, inteiro(horas, 1)),
    cadeiras: Math.max(1, inteiro(cadeiras, 1)),
  }

  function salvar() {
    setErro(null)
    iniciarTransicao(async () => {
      try {
        const r = await fetch('/api/v1/tenant/fixed-cost', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ mensalCents: previa.mensalCents, horasPorMes: previa.horasPorMes, cadeiras: previa.cadeiras }),
        })
        const json = (await r.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
        if (!r.ok) {
          const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
          setErro(campo ?? json.error?.message ?? 'Não consegui salvar.')
          return
        }
        setJaSalvou(true)
        mostrarToast({ tom: 'ok', titulo: 'Custo fixo salvo' })
      } catch {
        // Sem este `catch`, o React 19 relança para o error boundary da raiz e a tela some levando
        // o que a pessoa digitou (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  return (
    <Card>
      {jaSalvou ? null : (
        <AlertBanner tom="warn" className="mb-3">
          <p className="text-secundario">
            Enquanto você não responder, o CICLO calcula o que sobrou <strong>sem descontar o aluguel</strong>, e o número fica maior do
            que a verdade. Se você atende em casa e não tem esse custo, deixe em zero e salve mesmo assim.
          </p>
        </AlertBanner>
      )}

      <p className="text-corpo font-semibold">O que sai todo mês, atendendo ou não</p>
      <p className="mt-1 text-secundario text-txt-2">
        Aluguel, luz, água, internet, software. Vale a partir da próxima comanda fechada; as antigas não mudam.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        <label className="flex items-center justify-between gap-3">
          <span className="text-corpo text-txt">Sai por mês</span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="text-corpo text-txt-2">
              R$
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="1"
              value={mensal}
              onChange={(e) => setMensal(e.target.value)}
              aria-label="Quanto sai por mês de aluguel e contas, em reais"
              className="h-12 w-28 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-right text-corpo tabular text-txt"
            />
          </span>
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="text-corpo text-txt">Horas abertas no mês</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={744}
            step="1"
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            aria-label="Quantas horas o salão fica aberto por mês"
            className="h-12 w-28 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-right text-corpo tabular text-txt"
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="text-corpo text-txt">Postos de atendimento</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            step="1"
            value={cadeiras}
            onChange={(e) => setCadeiras(e.target.value)}
            aria-label="Quantas cadeiras ou postos atendem ao mesmo tempo"
            className="h-12 w-28 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-right text-corpo tabular text-txt"
          />
        </label>
      </div>

      {/*
        A prévia é o que torna as três perguntas compreensíveis: o dono não pensa em "custo por hora
        de cadeira", ele pensa em "3.500 de aluguel". Ver o número sair da conta dele, ao vivo, é o
        que explica por que o CICLO precisou perguntar as três coisas.
      */}
      <p className="mt-3 text-secundario text-txt-2">
        Cada hora de atendimento custa <strong className="tabular">{dinheiro.format(custoPorHoraDaCadeira(previa) / 100)}</strong> antes de
        qualquer coisa acontecer.
      </p>

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
