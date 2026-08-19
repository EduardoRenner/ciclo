import { ChevronRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'

import type { AcaoSugerida } from '@/server/services/crm'

const TOM: Record<AcaoSugerida['tom'], string> = {
  warn: 'border-warn/30 bg-warn/5',
  info: '',
  ok: 'border-ok/30 bg-ok/5',
}

/** "Próximo passo sugerido" — nunca aparece vazio: some da tela quando não há nada a sugerir. */
export default function CentralDeAcoes({ acoes }: { acoes: AcaoSugerida[] }) {
  if (acoes.length === 0) return null

  return (
    <section className="mb-6">
      <SectionHeader icone={<Sparkles className="size-3.5" />}>Vale a pena hoje</SectionHeader>
      <div className="grid gap-2">
        {acoes.map((acao) => (
          <Link key={acao.chave} href={acao.href} className="block">
            <Card className={`flex items-center gap-3 transition-colors hover:bg-surface-2 ${TOM[acao.tom]}`}>
              <div className="min-w-0 flex-1">
                <p className="text-corpo font-semibold">{acao.titulo}</p>
                <p className="mt-0.5 text-secundario text-txt-2">{acao.descricao}</p>
              </div>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-txt-3" />
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
