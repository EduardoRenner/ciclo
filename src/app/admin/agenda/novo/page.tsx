import { headers } from 'next/headers'

import { NOME_DO_PLANO, menorPlanoCom, podeUsarModulo } from '@/core/billing/planos'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDePlano } from '@/server/services/planos'
import { listarProfissionais } from '@/server/services/profissionais'
import { listarServicos } from '@/server/services/servicos'

import FormularioAgendamento from './formulario'
import PageHeader from '@/components/ui/page-header'

export const metadata = { title: "Novo agendamento" }

export default async function PaginaNovoAgendamento() {
  const ctx = await contextoAtual(new Request('https://interno/agenda/novo', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [servicos, profissionais, plano] = await Promise.all([
    listarServicos(db, ctx.tenantId),
    listarProfissionais(db, ctx.tenantId),
    contextoDePlano(db, ctx.tenantId),
  ])

  /*
   * "Repetir este horário" desviava o envio inteiro para `POST /appointments/series`, que exige o
   * módulo `recurrence` (Avançado). Quem estava no Grátis ou no Essencial marcava a caixa, montava
   * a recorrência e tocava em "Criar série" — a rota recusava e **nenhum agendamento era criado**.
   *
   * É o pior caso da classe que `recurso-pago-avisa-antes` descreve: aqui o recurso pago não só
   * frustrava a compra, ele bloqueava a ação GRÁTIS que a pessoa tinha vindo fazer. Marcar um
   * horário funciona em todo degrau; só a repetição é que não.
   *
   * O degrau vem de `menorPlanoCom` em vez de escrito à mão: se `recurrence` mudar de plano um dia,
   * a frase muda junto — é a mesma razão de `NOME_DO_PLANO` existir.
   */
  const podeRepetir = podeUsarModulo(plano, 'recurrence').estado === 'liberado'
  const planoDaRepeticao = menorPlanoCom('recurrence')

  return (
    <>
      <PageHeader titulo="Novo agendamento" />

      <FormularioAgendamento
        vocabulario={ctx.tenant.vocabulario}
        podeRepetir={podeRepetir}
        {...(planoDaRepeticao ? { planoDaRepeticao: NOME_DO_PLANO[planoDaRepeticao] } : {})}
        servicos={servicos.map((s) => ({
          id: s.id,
          name: s.name,
          duration_min: s.duration_min,
          price_cents: s.price_cents,
          pricing_model: s.pricing_model,
          hourly_rate_cents: s.hourly_rate_cents,
          half_day_price_cents: s.half_day_price_cents,
        }))}
        profissionais={profissionais.map((p) => ({ id: p.id, display_name: p.display_name }))}
      />
    </>
  )
}
