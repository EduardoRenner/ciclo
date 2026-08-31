import { diasDesde } from '@/core/tempo/dia'
import { primeiroNome } from '@/core/text/nome'
import { withNovoTenant } from '@/server/db/with-tenant'
import { gerarTokenAssinado, verificarTokenAssinado } from '@/server/services/token-assinado'
import { hashTelefone } from '@/server/services/telefone'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const ESCOPO = 'reconhecimento'

/**
 * 180 dias — mesma validade TÉCNICA do token de orçamento (`orcamento-token.ts`), pelo mesmo
 * motivo: cadência de retorno de beleza costuma ser semanas a poucos meses (`docs/34-PAGINA-
 * PUBLICA-PLANO.md`), e o token só abre a porta para uma consulta — quem decide o que mostrar é
 * `reconhecerCliente`, olhando o estado real do ciclo no banco.
 */
const VALIDADE_HORAS = 24 * 180

/**
 * Gerado a cada agendamento público concluído (`criarAgendamentoPublico`) e guardado só no
 * `localStorage` do navegador de quem agendou — nunca em cookie nem em URL. É o que permite
 * `reconhecerCliente` devolver nome e padrão de ciclo SEM expor um lookup aberto por telefone: só
 * quem já provou, num agendamento anterior deste tenant, que aquele telefone é dele recebe o
 * token de volta. Um visitante não pode forjar um para outra pessoa (assinatura HMAC) nem usá-lo
 * em outro tenant (o `tenantId` está dentro do payload assinado).
 */
export function gerarTokenReconhecimento(tenantId: string, phoneE164: string): string {
  return gerarTokenAssinado(ESCOPO, `${tenantId}:${phoneE164}`, VALIDADE_HORAS)
}

export type Reconhecimento = {
  primeiroNome: string
  diasDesdeUltima: number | null
  sugestao: { serviceId: string; serviceName: string; professionalId: string | null } | null
}

/**
 * `null` cobre tanto "token inválido/vencido" quanto "cliente apagada desde então" (LGPD art. 18
 * VI) — os dois casos são indistinguíveis de propósito para quem chama: nenhum vaza mais
 * informação que o outro.
 */
export async function reconhecerCliente(slug: string, token: string): Promise<Reconhecimento | null> {
  const payload = verificarTokenAssinado(ESCOPO, token)
  if (!payload) return null

  const [tenantId, phoneE164] = payload.split(':')
  if (!tenantId || !phoneE164) return null

  return withNovoTenant(async (svc: Cliente) => {
    const { data: tenant, error: erroTenant } = await svc
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .eq('id', tenantId)
      .is('deleted_at', null)
      .maybeSingle()
    if (erroTenant) throw new AppError('INTERNAL', { cause: erroTenant })
    // Token de outro tenant (ou tenant apagado) nunca chega a consultar `clients` — o payload
    // batendo com o `slug` é a prova de que o token pertence a ESTE salão.
    if (!tenant) return null

    const { data: cliente, error: erroCliente } = await svc
      .from('clients')
      .select('id, name, preferred_professional_id, last_visit_at, online_booking_blocked')
      .eq('tenant_id', tenantId)
      .eq('phone_hash', hashTelefone(phoneE164))
      .is('deleted_at', null)
      .maybeSingle()
    if (erroCliente) throw new AppError('INTERNAL', { cause: erroCliente })
    if (!cliente || cliente.online_booking_blocked) return null

    const { data: ciclo, error: erroCiclo } = await svc
      .from('client_cycles')
      .select('service_id, last_visit_on')
      .eq('tenant_id', tenantId)
      .eq('client_id', cliente.id)
      .not('last_visit_on', 'is', null)
      .order('last_visit_on', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (erroCiclo) throw new AppError('INTERNAL', { cause: erroCiclo })

    let sugestao: Reconhecimento['sugestao'] = null
    if (ciclo) {
      const { data: servico, error: erroServico } = await svc
        .from('services')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('id', ciclo.service_id)
        .eq('active', true)
        .eq('bookable_online', true)
        .is('deleted_at', null)
        .maybeSingle()
      if (erroServico) throw new AppError('INTERNAL', { cause: erroServico })
      if (servico) sugestao = { serviceId: servico.id, serviceName: servico.name, professionalId: cliente.preferred_professional_id }
    }

    const diasDesdeUltima = cliente.last_visit_at ? diasDesde(cliente.last_visit_at) : null

    return { primeiroNome: primeiroNome(cliente.name), diasDesdeUltima, sugestao }
  })
}
