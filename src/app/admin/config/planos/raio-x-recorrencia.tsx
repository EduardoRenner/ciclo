import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'
import { dinheiro } from '@/lib/formato'

import type { RaioXDeRecorrencia } from '@/core/loyalty/raio-x-de-recorrencia'

/**
 * CICLO Clube · C-03 — a pergunta que justifica o dono configurar um plano: "quantos dos meus
 * clientes já voltam rápido o bastante, e quanto vale se X% assinar?".
 *
 * Sem nenhum elegível, a seção some — não faz sentido mostrar cenário de adoção de zero pessoas, e
 * uma tela vazia aqui empurraria o dono para configurar um plano sem nenhuma evidência de demanda.
 */
export default function RaioXRecorrencia({ raioX }: { raioX: RaioXDeRecorrencia }) {
  if (raioX.totalElegiveis === 0) return null

  return (
    <section className="mt-7">
      <SectionHeader>Quem já dá pra virar assinante</SectionHeader>
      <Card>
        <p className="text-corpo font-semibold">
          {raioX.totalElegiveis} {raioX.totalElegiveis === 1 ? 'cliente volta' : 'clientes voltam'} a cada 45 dias ou menos
        </p>
        <p className="mt-1 text-secundario text-txt-2">Ticket médio de {dinheiro.format((raioX.ticketMedioCents ?? 0) / 100)} por visita.</p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {raioX.cenarios.map((c) => (
            <div key={c.adocaoPercentual} className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 p-3">
              <p className="text-label font-semibold text-txt-2">Se {c.adocaoPercentual}% assinar</p>
              <p className="mt-1 text-corpo font-semibold text-acc-2">{dinheiro.format(c.receitaPotencialCents / 100)}/mês</p>
              <p className="text-secundario text-txt-3">
                {c.assinantesEstimados} {c.assinantesEstimados === 1 ? 'assinante' : 'assinantes'}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  )
}
