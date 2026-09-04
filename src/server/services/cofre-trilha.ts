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
  /*
   * `actor_label` existe em `vault_access_log` desde a migration 0001 e **nunca foi escrito** —
   * achado em 2026-09-03 varrendo colunas sem leitor nem escritor, a mesma classe de `fee_cents`,
   * `consent_id`, `tenants.plan`, `referred_by` e `trial_ends_at`.
   *
   * **O que a ausência dela custava.** A tela "Trilha do cofre" promete *"quem acessou a ficha de
   * saúde de cada cliente"*, e resolvia o nome ao LER, juntando `actor_id` com `profiles`. Quando
   * o profissional sai do salão e o perfil dele some, TODOS os acessos passados dele viram
   * "Usuário removido" — de uma vez, para sempre. Rotatividade de equipe em salão é o caso normal,
   * não a exceção, então a trilha de dado de saúde perdia o ator justamente no cenário em que
   * alguém iria consultá-la.
   *
   * O nome é gravado como INSTANTÂNEO: é o que era verdade no momento do acesso, e é o que
   * sobrevive à saída da pessoa. Ele não substitui o `actor_id` — quem some é o perfil, não o
   * vínculo.
   *
   * **Isto não conflita com `trilha-nao-guarda-dado-eliminado`**, e a distinção importa: aquela
   * guarda protege o dado da CLIENTE (nome, telefone, alergia), que a LGPD manda eliminar quando
   * ela pede. Aqui o dado é de quem ACESSOU — profissional, não titular do prontuário —, e o
   * registro de quem tocou em dado de saúde é a obrigação que a trilha existe para cumprir.
   * `clientName` continua derivado de propósito, e continua virando "Cliente removida".
   *
   * A busca é **melhor esforço**: se falhar, o registro entra sem o rótulo. O contrato desta
   * função é que o acesso ao cofre nunca fique sem trilha, e um nome bonito não vale perder isso.
   */
  let rotuloDoAtor: string | null = null
  if (quem.actorId) {
    const { data } = await db.from('profiles').select('full_name').eq('id', quem.actorId).maybeSingle()
    rotuloDoAtor = data?.full_name ?? null
  }

  const { error } = await db.from('vault_access_log').insert({
    tenant_id: tenantId,
    client_id: clientId,
    actor_id: quem.actorId,
    actor_label: rotuloDoAtor,
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
