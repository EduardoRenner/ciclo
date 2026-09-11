'use client'

import { Plus, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { QUANDO_FOI, type QuandoFoi } from '@/core/ciclo/quando-foi-a-ultima-vez'

export type ServicoComRitmo = { id: string; nome: string; cycleDays: number }

type Pessoa = { nome: string; telefone: string; quando: QuandoFoi }
type Resultado = {
  cadastrados: number
  jaExistiam: string[]
  previsao: { comDataInformada: number; jaDevendoVoltar: number; cyclesGravados: number } | null
}

const LINHA_VAZIA: Pessoa = { nome: '', telefone: '', quando: 'quinzena' }

/** Três linhas abertas: uma só parece um formulário de cadastro avulso, e a tarefa aqui é em lote. */
const INICIAIS = [LINHA_VAZIA, LINHA_VAZIA, LINHA_VAZIA]

export default function FormularioQuemJaAtendo({ servicos }: { servicos: ServicoComRitmo[] }) {
  const [serviceId, setServiceId] = useState(servicos[0]?.id ?? '')
  const [pessoas, setPessoas] = useState<Pessoa[]>(INICIAIS)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [pendente, iniciarTransicao] = useTransition()
  const mostrarToast = useToast()

  const preenchidas = pessoas.filter((p) => p.nome.trim() !== '')

  function mudar(indice: number, campo: keyof Pessoa, valor: string) {
    setPessoas((atual) => atual.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)))
  }

  function enviar() {
    if (preenchidas.length === 0 || !serviceId) return

    iniciarTransicao(async () => {
      try {
        const r = await fetch('/api/v1/clients/ja-atendo', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({
            serviceId,
            pessoas: preenchidas.map((p) => ({ nome: p.nome.trim(), telefone: p.telefone.trim() || undefined, quando: p.quando })),
          }),
        })
        const json = (await r.json()) as { data?: Resultado; error?: { message: string } }
        if (!r.ok) throw new Error(json.error?.message ?? 'Não consegui salvar.')
        setResultado(json.data!)
        setPessoas(INICIAIS)
        mostrarToast({ tom: 'ok', titulo: 'Pronto', descricao: `${json.data!.cadastrados} pessoas no seu caderno.` })
      } catch (erro) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui salvar', descricao: (erro as Error).message })
      }
    })
  }

  if (resultado) {
    const p = resultado.previsao
    const noMotor = (p?.cyclesGravados ?? 0) > 0
    return (
      <div className="flex flex-col gap-4">
        {/*
          A recompensa. Esta tela existe para produzir ESTE cartão — é o momento em que uma lista de
          nomes digitados vira "olha quem já devia ter voltado", que é o produto. Vem antes da
          contagem seca, pelo mesmo motivo que na importação.
        */}
        {p && p.jaDevendoVoltar > 0 && noMotor ? (
          <Link href="/admin/recuperar" className="block">
            <Card pressionavel className="border-acc-2/40 bg-acc-soft">
              <div className="flex items-start gap-3">
                <Sparkles aria-hidden className="mt-0.5 size-6 shrink-0 text-acc-2" />
                <div>
                  <p className="text-corpo font-semibold text-acc-2">
                    {p.jaDevendoVoltar} {p.jaDevendoVoltar === 1 ? 'pessoa já está' : 'pessoas já estão'} atrasadas para voltar
                  </p>
                  <p className="mt-1 text-secundario text-txt-2">
                    O Motor de Ciclo já está acompanhando essa gente. Ver quem são →
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ) : null}

        <Card>
          <p className="text-corpo font-semibold">{resultado.cadastrados} pessoas cadastradas</p>
          {resultado.jaExistiam.length > 0 ? (
            <p className="mt-1 text-secundario text-txt-2">
              {resultado.jaExistiam.length === 1 ? 'Já tinha ficha' : 'Já tinham ficha'}: {resultado.jaExistiam.join(', ')}.
            </p>
          ) : null}
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setResultado(null)}>Adicionar mais gente</Button>
          <Link
            href="/admin/hoje"
            className="inline-flex h-12 items-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt"
          >
            Ir para o Hoje
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div aria-busy={pendente} className="flex flex-col gap-5">
      <section>
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Que serviço essas pessoas fazem com você?</span>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
          >
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} · volta a cada {s.cycleDays} dias
              </option>
            ))}
          </select>
          <span className="text-secundario text-txt-3">
            É por ele que o CICLO sabe de quanto em quanto tempo cada pessoa costuma voltar.
          </span>
        </label>
      </section>

      <section className="flex flex-col gap-3">
        {pessoas.map((pessoa, i) => (
          <Card key={i} className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Input rotulo={`Nome ${i + 1}`} value={pessoa.nome} onChange={(e) => mudar(i, 'nome', e.target.value)} placeholder="Ex.: Dona Alzira" />
              </div>
              {pessoas.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setPessoas((atual) => atual.filter((_, j) => j !== i))}
                  aria-label={`Tirar a linha ${i + 1}`}
                  className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-sm)] text-txt-3 transition active:scale-95"
                >
                  <X aria-hidden className="size-5" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {/*
                `min-w` de 128px, e o número é medido, não escolhido: a 375px sobram ~311px dentro do
                cartão, então dois campos de 150px (o valor anterior) não cabiam e quebravam linha —
                cada pessoa ocupava ~250px de altura. Numa tela cujo trabalho é digitar quinze
                nomes, isso é rolagem que a tarefa não precisa.
              */}
              <label className="flex min-w-[128px] flex-1 flex-col gap-1">
                <span className="text-label font-semibold text-txt-2">Última vez</span>
                <select
                  value={pessoa.quando}
                  onChange={(e) => mudar(i, 'quando', e.target.value)}
                  className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
                >
                  {QUANDO_FOI.map((q) => (
                    <option key={q.valor} value={q.valor}>
                      {q.rotulo}
                    </option>
                  ))}
                </select>
              </label>
              <div className="min-w-[128px] flex-1">
                <Input
                  rotulo="WhatsApp (opcional)"
                  value={pessoa.telefone}
                  onChange={(e) => mudar(i, 'telefone', e.target.value)}
                  inputMode="tel"
                  placeholder="(51) 99999-9999"
                />
              </div>
            </div>
          </Card>
        ))}

        <button
          type="button"
          onClick={() => setPessoas((atual) => [...atual, LINHA_VAZIA])}
          className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-line-2 text-corpo font-semibold text-txt-2 transition active:scale-[.99]"
        >
          <Plus aria-hidden className="size-4" />
          Adicionar mais uma
        </button>
      </section>

      {/*
        O número no botão é o que diz que a tarefa está avançando — numa tela de digitação em lote, o
        rótulo fixo ("Salvar") não distingue uma linha preenchida de quinze.
      */}
      <Button
        carregando={pendente}
        onClick={enviar}
        disabled={preenchidas.length === 0 || !serviceId}
        motivoDesabilitado={
          preenchidas.length === 0 ? 'Escreva o nome de pelo menos uma pessoa.' : 'Escolha acima o serviço que essas pessoas fazem.'
        }
      >
        {preenchidas.length === 0
          ? 'Escreva pelo menos um nome'
          : `Pôr ${preenchidas.length} ${preenchidas.length === 1 ? 'pessoa' : 'pessoas'} no Motor`}
      </Button>
    </div>
  )
}
