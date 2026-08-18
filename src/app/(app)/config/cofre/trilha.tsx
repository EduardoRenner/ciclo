'use client'

import { ShieldCheck } from 'lucide-react'

import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'

import type { LinhaTrilhaCofre } from '@/server/services/trilha-cofre'

const ROTULO_ACAO: Record<string, string> = {
  read: 'Abriu',
  write: 'Preencheu',
  export: 'Exportou',
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function TrilhaCofre({ entradasIniciais }: { entradasIniciais: LinhaTrilhaCofre[] }) {
  if (entradasIniciais.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icone={<ShieldCheck aria-hidden className="size-6" />}
          titulo="Nenhum acesso ainda"
          descricao="Toda vez que alguém abrir a ficha de saúde de uma cliente, aparece aqui."
          acao={<span className="text-secundario text-txt-3">Nada pra ver por enquanto</span>}
        />
      </Card>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {entradasIniciais.map((e) => (
        <li key={e.id}>
          <Card>
            <p className="text-corpo font-semibold">{e.clientName}</p>
            <p className="text-secundario text-txt-2">
              {ROTULO_ACAO[e.action] ?? e.action} por <span className="font-semibold text-txt">{e.actorName}</span> · {dataHora(e.createdAt)}
            </p>
            {e.ip ? <p className="tabular text-label text-txt-3">IP {e.ip}</p> : null}
          </Card>
        </li>
      ))}
    </ul>
  )
}
