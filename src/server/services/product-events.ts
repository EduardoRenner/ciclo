import type { Database, Json } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * G-05a (docs/60) — a instrumentação mínima do funil. Grava em `product_events` e NUNCA lança:
 * evento perdido não pode derrubar o fluxo que ele observa, mesma regra do heartbeat do cron
 * (`docs/27` §P5). Quem chama não precisa de `try/catch` próprio.
 */
export async function registrarEvento(
  db: Cliente,
  tenantId: string,
  tipo: string,
  meta: Record<string, Json> = {},
): Promise<void> {
  try {
    const { error } = await db.from('product_events').insert({ tenant_id: tenantId, event_type: tipo, meta })
    if (error) throw error
  } catch (erro) {
    console.warn(JSON.stringify({ level: 'warn', event: 'product_event_perdido', tipo }), erro)
  }
}

/**
 * Para eventos-marco (uma vez por tenant, como `motor_viu_valor`) — sem constraint de unicidade no
 * schema (os eventos do G-05b são repetíveis), o dedupe de "primeiro visto" é responsabilidade de
 * quem grava. A checagem por `limit(1)` custa uma consulta indexada (`product_events_tenant_tipo_idx`)
 * a mais só na tela que dispara o evento — não em toda leitura do funil.
 */
export async function registrarPrimeiraOcorrencia(
  db: Cliente,
  tenantId: string,
  tipo: string,
  meta: Record<string, Json> = {},
): Promise<void> {
  try {
    const { data, error } = await db.from('product_events').select('id').eq('tenant_id', tenantId).eq('event_type', tipo).limit(1)
    if (error) throw error
    if (data && data.length > 0) return
    await registrarEvento(db, tenantId, tipo, meta)
  } catch (erro) {
    console.warn(JSON.stringify({ level: 'warn', event: 'product_event_perdido', tipo }), erro)
  }
}
