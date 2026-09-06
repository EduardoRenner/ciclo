import Link from 'next/link'

import AlertBanner from '@/components/ui/alert-banner'
import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'
import { dinheiro } from '@/lib/formato'

import type { MargemDoClube } from '@/server/services/clube'

function periodo(desde: string, ate: string): string {
  const dia = (iso: string) => {
    const [ano, mes, d] = iso.split('-').map(Number)
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(ano!, mes! - 1, d!)))
  }
  return `${dia(desde)} a ${dia(ate)}`
}

/**
 * `docs/48` C6. `docs/47` P06 é o motivo: *"receita antecipada não é lucro antecipado"* — no plano
 * ilimitado basta uma parcela usar acima da média e a margem despenca **sem aviso prévio**. Todos
 * os concorrentes pesquisados vendem clube de assinatura; nenhum avisa quando um assinante virou
 * prejuízo.
 *
 * A lista vem do pior para o melhor de propósito: quem abre esta tela não quer conferir os 40 que
 * estão bem, quer ver os 2 que não estão.
 */
export default function MargemDoClube({ margens }: { margens: MargemDoClube[] }) {
  if (margens.length === 0) return null

  const noVermelho = margens.filter((m) => m.noPrejuizo)
  const semFicha = margens.reduce((soma, m) => soma + m.visitasSemFicha, 0)

  return (
    <section className="mt-7">
      <SectionHeader>Margem do clube</SectionHeader>

      {noVermelho.length > 0 ? (
        <AlertBanner tom="warn" className="mb-3">
          <p className="text-secundario">
            {noVermelho.length === 1
              ? `1 assinante está custando mais do que paga neste ciclo.`
              : `${noVermelho.length} assinantes estão custando mais do que pagam neste ciclo.`}
          </p>
        </AlertBanner>
      ) : null}

      <Card className="flex flex-col gap-3">
        {margens.map((m) => (
          <div key={m.clientId} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <Link href={`/admin/clientes/${m.clientId}`} className="min-w-0 truncate text-corpo font-semibold text-txt">
                {m.clientName}
              </Link>
              <span className={`tabular shrink-0 text-corpo font-bold ${m.noPrejuizo ? 'text-bad' : 'text-acc-2'}`}>
                {dinheiro.format(m.margemCents / 100)}
              </span>
            </div>
            <p className="text-secundario text-txt-2">
              {m.planName} · paga {dinheiro.format(m.mensalidadeCents / 100)} · {m.visitas === 1 ? '1 atendimento' : `${m.visitas} atendimentos`} custando{' '}
              {dinheiro.format(m.custoCents / 100)}
              {m.acimaDoLimite && m.limiteSessoes !== null ? ` · passou das ${m.limiteSessoes} do plano` : ''}
            </p>
            <p className="text-label text-txt-3">{periodo(m.desde, m.ate)}</p>
          </div>
        ))}
      </Card>

      {/*
        O mesmo "estado incompleto honesto" do `docs/48` §Fase 3: sem ficha de consumo, o material
        entra como zero e a margem sai MAIOR do que é — que é o erro perigoso aqui, porque este
        quadro existe justamente para achar quem está no vermelho.
      */}
      {semFicha > 0 ? (
        <p className="mt-2 text-label text-txt-3">
          {semFicha === 1 ? '1 atendimento entrou' : `${semFicha} atendimentos entraram`} sem o custo de produto: o serviço ainda não tem ficha de
          consumo, então a margem acima está mais otimista do que a real.{' '}
          <Link href="/admin/config/servicos" className="font-semibold text-acc-2">
            Preencher a ficha
          </Link>
        </p>
      ) : null}
    </section>
  )
}
