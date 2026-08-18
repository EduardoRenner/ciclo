import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from './types.gen'

/**
 * Único ponto do código com a chave que ignora a RLS. Há regra de lint
 * (`ciclo/service-client-confinado`) que reprova o nome `createServiceClient` e
 * `SUPABASE_SERVICE_ROLE_KEY` em qualquer outro arquivo.
 */
function createServiceClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) throw new Error('withTenant: falta NEXT_PUBLIC_SUPABASE_URL ou a service role key')

  return createClient<Database>(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Empresta o cliente de serviço para uma operação de um tenant só.
 *
 * **O que este wrapper garante e o que não garante.** `01-ESPEC-TECNICA §2.3`
 * desenha o wrapper chamando `set_tenant_context()` antes e `clear_tenant_context()`
 * depois, como se o `app.tenant_id` protegesse as consultas de dentro. Medido no
 * banco do projeto, não protege:
 *
 * - `set_tenant_context` usa `set_config(..., true)`, que é escopo de transação,
 *   e cada chamada pelo PostgREST é uma transação própria — o valor já não existe
 *   na chamada seguinte (verificado: volta vazio);
 * - nenhuma das políticas de RLS deste schema lê `app.tenant_id` (verificado:
 *   zero em `pg_policies`). Elas decidem por `auth.uid()`, que a service role
 *   não tem.
 *
 * Então as duas chamadas seriam duas idas de rede por escrita para não fazer
 * nada, e ficaram de fora. O que de fato isola aqui é: a chave mora só neste
 * arquivo, o `tenantId` é conferido antes de virar consulta, e **quem usa o
 * cliente precisa filtrar `tenant_id` explicitamente** — que é o que a FAQ C30
 * já manda fazer mesmo com a RLS ligada.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (db: SupabaseClient<Database>, tenantId: string) => Promise<T>,
): Promise<T> {
  if (!UUID.test(tenantId)) throw new Error('withTenant: tenantId inválido')
  return fn(createServiceClient(), tenantId)
}

/**
 * Variante para o único momento em que ainda não existe `tenantId`: o
 * onboarding (TICKET-015) cria o tenant, a membership, o professional e a DEK
 * antes de a pessoa ter qualquer vínculo — nada disso passa pela RLS do
 * cliente porque o `has_tenant()` ainda não teria o que responder. Continua
 * confinado a este arquivo pelo mesmo motivo do `withTenant`.
 */
export async function withNovoTenant<T>(fn: (db: SupabaseClient<Database>) => Promise<T>): Promise<T> {
  return fn(createServiceClient())
}
