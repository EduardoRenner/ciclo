import { Package, Wallet } from 'lucide-react'

import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'
import { dinheiro } from '@/lib/formato'

type Props = {
  pacotes: { id: string; serviceName: string; restantes: number; total: number; expiresOn: string | null }[]
  saldoCarteiraCents: number
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * Pacotes (TICKET-046) e carteira/fiado (TICKET-047) já existem prontos — venda e consumo
 * acontecem na comanda, então aqui é só leitura: o que essa cliente já tem contratado, visível
 * na hora de decidir se cobra ou desconta de um pacote.
 */
export default function PacotesCarteira({ pacotes, saldoCarteiraCents }: Props) {
  if (pacotes.length === 0 && saldoCarteiraCents === 0) return null

  return (
    <section className="mt-7">
      <SectionHeader icone={<Package className="size-3.5" />}>Pacotes e carteira</SectionHeader>
      <div className="grid gap-2">
        {saldoCarteiraCents !== 0 ? (
          <Card className="flex items-center gap-3">
            <Wallet className={saldoCarteiraCents > 0 ? 'size-5 shrink-0 text-ok' : 'size-5 shrink-0 text-bad'} />
            <div className="min-w-0 flex-1">
              <p className="text-corpo font-semibold">Saldo na carteira</p>
              <p className="text-secundario text-txt-2">
                {saldoCarteiraCents < 0 ? 'Cliente deve ' : 'Cliente tem '}
                {dinheiro.format(Math.abs(saldoCarteiraCents) / 100)}
              </p>
            </div>
          </Card>
        ) : null}

        {pacotes.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-corpo font-semibold">{p.serviceName}</p>
              <p className="tabular shrink-0 text-corpo font-bold text-acc-2">
                {p.restantes}/{p.total}
              </p>
            </div>
            {p.expiresOn ? <p className="mt-0.5 text-secundario text-txt-3">Vence em {dataCurta(p.expiresOn)}</p> : null}
          </Card>
        ))}
      </div>
    </section>
  )
}
