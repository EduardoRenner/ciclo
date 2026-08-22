import { headers } from 'next/headers'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Temporal } from '@js-temporal/polyfill'

import EmptyState from '@/components/ui/empty-state'
import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import { avaliarPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { fechamentoDiario, resumoMensal } from '@/server/services/caixa'
import { extratoDeComissao } from '@/server/services/comissao'

import Caixa from './caixa'

const DATA = /^\d{4}-\d{2}-\d{2}$/

/**
 * O fechamento de caixa existia inteiro no servidor desde o TICKET-047
 * (`services/caixa.ts`, `GET /cash/daily`, `GET /cash/summary`) e nunca teve
 * tela — a pasta `admin/caixa/` estava no repositório, vazia. É o ritual diário
 * de quem tem salão ("quanto entrou hoje, quanto sobrou"), e era a única
 * pergunta do produto que só dava para responder pelo banco.
 */
export default async function PaginaCaixa({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const ctx = await contextoAtual(new Request('https://interno/caixa', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  // Dinheiro do negócio inteiro não é de todo papel: `professional` e `reception`
  // não têm `report:read` (§3.3). A RLS ainda é a rede embaixo — isto é a
  // primeira camada, para a tela não abrir vazia sem explicar o motivo.
  if (!avaliarPermissao(ctx.papel, 'report:read')) {
    return (
      <>
        <PageHeader titulo="Caixa" />
        <Card className="p-0">
          <EmptyState
            icone={<Lock aria-hidden className="size-6" />}
            titulo="Você não tem acesso ao caixa"
            descricao="Só quem cuida do financeiro do negócio vê o fechamento. Peça ao dono se precisar."
            acao={<Link href="/admin/hoje">Voltar para Hoje</Link>}
          />
        </Card>
      </>
    )
  }

  const { data: tenantRow } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).single()
  const timezone = tenantRow?.timezone ?? 'America/Sao_Paulo'

  const hoje = Temporal.Now.instant().toZonedDateTimeISO(timezone).toPlainDate()
  const pedido = (await searchParams).dia
  // Data do futuro não é erro de digitação a ser rejeitado com mensagem: é
  // "ainda não aconteceu". Volta para hoje, que é o que a pessoa queria ver.
  const dia = pedido && DATA.test(pedido) && Temporal.PlainDate.compare(pedido, hoje) <= 0 ? Temporal.PlainDate.from(pedido) : hoje
  const mes = `${dia.year}-${String(dia.month).padStart(2, '0')}`

  // O caixa conta comanda fechada; "Faturado hoje" conta atendimento concluído.
  // São fontes diferentes de propósito (§5.7: receita é o que foi cobrado), mas
  // quem toca no número de "Hoje" e cai num caixa zerado merece saber por quê —
  // por isso o total de atendimentos do dia vem junto, só para o estado vazio.
  const inicioDoDia = dia.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  const fimDoDia = dia.add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()

  const [diario, mensal, profissionais, atendimentos] = await Promise.all([
    fechamentoDiario(db, ctx.tenantId, timezone, dia.toString()),
    resumoMensal(db, ctx.tenantId, timezone, mes),
    db.from('professionals').select('id, display_name').eq('tenant_id', ctx.tenantId).eq('active', true).order('display_name'),
    db
      .from('appointments')
      .select('price_cents')
      .eq('tenant_id', ctx.tenantId)
      .eq('status', 'done')
      .gte('starts_at', inicioDoDia)
      .lt('starts_at', fimDoDia),
  ])

  const atendidoCents = (atendimentos.data ?? []).reduce((soma, a) => soma + a.price_cents, 0)

  const inicioDoMes = `${mes}-01`
  const fimDoMes = Temporal.PlainDate.from(inicioDoMes).add({ months: 1 }).subtract({ days: 1 }).toString()

  // Comissão é do papel `finance`/`owner`, não de quem só lê relatório — quem
  // não alcança vê o caixa sem esta seção, em vez de ver 403 na tela inteira.
  const comissoes = avaliarPermissao(ctx.papel, 'commission:read')
    ? await Promise.all(
        (profissionais.data ?? []).map(async (p) => ({
          id: p.id,
          nome: p.display_name,
          totalCents: (await extratoDeComissao(db, ctx.tenantId, p.id, inicioDoMes, fimDoMes)).totalCents,
        })),
      )
    : []

  return (
    <Caixa
      dia={dia.toString()}
      hoje={hoje.toString()}
      diario={diario}
      mensal={mensal}
      comissoes={comissoes}
      atendidoCents={atendidoCents}
    />
  )
}
