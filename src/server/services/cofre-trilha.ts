import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export type AcessoAoCofre = 'read' | 'export'

export type QuemAcessou = { actorId: string | null; ip: string | null; userAgent: string | null }

/**
 * Escreve a trilha de acesso ao cofre (`vault_access_log`) — quem abriu a ficha de saúde de quem,
 * quando, de qual IP. É a peça de LGPD que sustenta a tela "Trilha do cofre".
 *
 * Existe como função porque os três chamadores (anamnese, exportação de dados e mídia) faziam o
 * `insert` soltos, **sem olhar o `error` de retorno** — e o supabase-js não lança em erro de banco.
 * Uma recusa do Postgres deixava o acesso ao dado de saúde sem registro nenhum, em silêncio.
 * Mesmo defeito que existia no `writeAudit`, no mesmo dia, pelo mesmo motivo.
 *
 * A falha **não derruba** a operação: a pessoa já leu a ficha, e estourar depois disso mostraria
 * erro para algo que deu certo — e, pior, poderia fazê-la tentar de novo, gerando mais acessos.
 * O que a falha faz é virar alarme no log, que é onde alguém consegue reagir. Mesmo contrato do
 * `writeAudit`, de propósito: trilha que falha em silêncio é pior que trilha ausente, porque
 * ninguém sabe que não tem.
 */
export async function registrarAcessoAoCofre(
  db: Cliente,
  tenantId: string,
  clientId: string,
  acao: AcessoAoCofre,
  quem: QuemAcessou,
): Promise<void> {
  const { error } = await db.from('vault_access_log').insert({
    tenant_id: tenantId,
    client_id: clientId,
    actor_id: quem.actorId,
    action: acao,
    ip: quem.ip,
    user_agent: quem.userAgent,
  })

  if (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'cofre_trilha_falhou',
        action: acao,
        tenant_id: tenantId,
        // `client_id` entra porque é o que permite reconstruir o que ficou sem registro. Não é
        // dado de saúde — é identificador —, então não cai na regra 9 do CLAUDE.md.
        client_id: clientId,
      }),
      error,
    )
  }
}
