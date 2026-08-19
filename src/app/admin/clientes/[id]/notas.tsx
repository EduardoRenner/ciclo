'use client'

import { NotebookPen } from 'lucide-react'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'

import type { NotaDoCliente } from '@/server/services/notas'

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/**
 * `clients.notes` era um campo só, que se sobrescreve — anotar algo novo apaga o que já estava
 * lá. Isto é o histórico de verdade: cada visita pode deixar a própria anotação, com quem
 * escreveu e quando. Nunca edita nem apaga (regra 11) — é registro, não rascunho.
 */
export default function Notas({ clientId, iniciais }: { clientId: string; iniciais: NotaDoCliente[] }) {
  const [notas, setNotas] = useState(iniciais)
  const [escrevendo, setEscrevendo] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciarTransicao] = useTransition()

  function salvar() {
    setErro(null)
    if (texto.trim().length < 2) {
      setErro('Escreva a anotação.')
      return
    }
    iniciarTransicao(async () => {
      const r = await fetch(`/api/v1/clients/${clientId}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ body: texto.trim() }),
      })
      const json = (await r.json()) as { data?: { id: string; created_at: string }; error?: { message: string } }
      if (!r.ok || !json.data) {
        setErro(json.error?.message ?? 'Não consegui salvar.')
        return
      }
      setNotas((atual) => [{ id: json.data!.id, body: texto.trim(), createdAt: json.data!.created_at, autor: null }, ...atual])
      setTexto('')
      setEscrevendo(false)
    })
  }

  return (
    <section className="mt-7">
      <SectionHeader icone={<NotebookPen className="size-3.5" />}>Anotações</SectionHeader>

      {escrevendo ? (
        <Card className="mb-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
            rows={3}
            placeholder="O que vale lembrar da próxima vez..."
            className="w-full rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 py-2 text-corpo text-txt"
          />
          {erro ? (
            <p role="alert" className="mt-1.5 text-secundario text-bad">
              {erro}
            </p>
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              variante="secondary"
              onClick={() => {
                setEscrevendo(false)
                setErro(null)
              }}
            >
              Cancelar
            </Button>
            <Button carregando={pendente} onClick={salvar}>
              Salvar
            </Button>
          </div>
        </Card>
      ) : (
        <Button variante="secondary" largura="cheia" onClick={() => setEscrevendo(true)} className="mb-2">
          Adicionar anotação
        </Button>
      )}

      {notas.length > 0 ? (
        <Card className="divide-y divide-line p-0">
          {notas.slice(0, 8).map((n) => (
            <div key={n.id} className="px-4 py-3">
              <p className="whitespace-pre-wrap text-corpo text-txt">{n.body}</p>
              <p className="mt-1 text-label text-txt-3">
                {dataHora(n.createdAt)}
                {n.autor ? ` · ${n.autor}` : ''}
              </p>
            </div>
          ))}
        </Card>
      ) : null}
    </section>
  )
}
