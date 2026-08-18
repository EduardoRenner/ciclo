import { Temporal } from '@js-temporal/polyfill'

import { enviarParaRecuperar, listarParaRecuperar, type ResultadoEnviarRecuperar } from '@/server/services/recuperar-receita'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const LIMITE_POR_RODADA = 200

/**
 * TICKET-038. A versão automática de `enviarParaRecuperar` (TICKET-037): em vez da
 * profissional escolher quem avisar na tela, o job seleciona sozinho todo mundo que
 * `v_recover_revenue` já elege como due/late/at_risk/lost. Os limites de verdade (7 dias
 * entre campanhas, janela 8h-21h, opt-out) já vivem dentro de `enviarParaRecuperar` — este
 * job não duplica a regra, só decide QUEM entra na lista.
 */
export async function executarCampanhaDiaria(
  db: Cliente,
  tenantId: string,
  timezone: string,
  agora: Temporal.Instant = Temporal.Now.instant(),
): Promise<ResultadoEnviarRecuperar> {
  const candidatos = await listarParaRecuperar(db, tenantId, { limit: LIMITE_POR_RODADA })
  if (candidatos.items.length === 0) return { queued: 0, skipped: [] }

  return enviarParaRecuperar(
    db,
    tenantId,
    timezone,
    {
      items: candidatos.items.map((item) => ({ clientId: item.clientId, serviceId: item.serviceId })),
      mode: 'template',
    },
    undefined,
    agora,
  )
}
