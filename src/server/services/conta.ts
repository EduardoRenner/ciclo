import { bloqueioDeTitularSemSucessor } from '@/core/auth/bloqueio-de-titular'
import { ASSUNTO_TRANSFERIR_TITULARIDADE, canalDeContato } from '@/lib/contato'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>
type Papel = Database['public']['Enums']['user_role']

/**
 * T-DEL (docs/64 §0.3): guideline 5.1.1(v) da Apple e a exigência equivalente do Google Play
 * pedem um caminho, DENTRO do app, pra quem criou conta excluir a própria conta — sem precisar
 * ligar ou mandar e-mail. É também lacuna de LGPD (art. 18 VI) independente de loja nenhuma: o
 * CICLO já dá esse direito à CLIENTE do salão (`server/services/lgpd.ts`, `eliminarCliente`), mas
 * nunca deu a quem opera o próprio CICLO.
 *
 * ## Por que a exclusão em si é tão mais simples que `eliminarCliente`
 *
 * `profiles.id` tem FK pra `auth.users(id) on delete cascade` (migration 0032), e
 * `memberships.user_id` tem FK pra `profiles(id) on delete cascade` (migration 0001). Chamar
 * `auth.admin.deleteUser` já cascade tudo isso sozinho — sem UPDATE manual coluna por coluna. E
 * `professionals.user_id` é `on delete set null`: o profissional em si SOBREVIVE (nome, agenda,
 * histórico de atendimento — regra 11 do CLAUDE.md, nunca apagar agendamento), só perde o login.
 *
 * ## O que este módulo decide, e o que ele recusa decidir sozinho
 *
 * Quem é `owner` **sozinho** num tenant (o caso comum: dono que atende também) pode se excluir —
 * o tenant fica órfão de login, mas o dado do negócio (clientes, histórico, caixa) continua
 * intacto, exatamente como cair de plano nunca apaga dado (regra 5.1 já documentada no projeto).
 * Quem é `owner` de um tenant com OUTRAS pessoas na equipe é recusado: apagar o único dono
 * deixaria `manager`/`finance`/quem mais estiver lá sem ninguém que possa fazer ação de dono
 * (mudar plano, adicionar gente). Este módulo não tenta escolher um substituto sozinho — isso é
 * transferência de titularidade, uma feature própria que ainda não existe, e decidir por conta
 * própria quem vira o dono novo seria inventar uma regra de negócio que ninguém pediu.
 */

export type VinculoDaConta = { tenantId: string; role: Papel }

export type SituacaoDaConta = {
  vinculos: VinculoDaConta[]
  /** Vazio = pode excluir. Cada frase já é o texto pronto pra mostrar na tela de confirmação. */
  bloqueios: string[]
}

/**
 * Só LÊ — nunca lança por causa do resultado, porque a UI precisa mostrar o motivo do bloqueio
 * numa tela de confirmação ANTES de a pessoa tentar de verdade (T-DEL critério 4: confirmação de
 * duas etapas, texto claro do que acontece), não descobrir por um 400 solto.
 */
export async function situacaoDaConta(svc: Cliente, userId: string): Promise<SituacaoDaConta> {
  const { data, error } = await svc.from('memberships').select('tenant_id, role').eq('user_id', userId).eq('active', true)
  if (error) throw new AppError('INTERNAL', { cause: error })
  const vinculos = (data ?? []).map((v) => ({ tenantId: v.tenant_id, role: v.role }))

  const bloqueios: string[] = []
  const tenantsQueSouDono = vinculos.filter((v) => v.role === 'owner').map((v) => v.tenantId)
  for (const tenantId of tenantsQueSouDono) {
    const { count, error: erroContagem } = await svc
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('active', true)
    if (erroContagem) throw new AppError('INTERNAL', { cause: erroContagem })
    if ((count ?? 0) > 1) {
      bloqueios.push(
        bloqueioDeTitularSemSucessor(canalDeContato(ASSUNTO_TRANSFERIR_TITULARIDADE) !== null),
      )
    }
  }

  return { vinculos, bloqueios }
}

/**
 * A exclusão em si. `svc` precisa ser service_role (`auth.admin.deleteUser` exige) — a rota chama
 * isto dentro de `withNovoTenant`, o mesmo padrão que o onboarding usa pra operação que ainda não
 * tem um `tenantId` fixo pra `withTenant` de um tenant só.
 */
export async function excluirPropriaConta(svc: Cliente, userId: string): Promise<VinculoDaConta[]> {
  const { vinculos, bloqueios } = await situacaoDaConta(svc, userId)
  if (bloqueios.length > 0) throw AppError.validacao({ _corpo: bloqueios[0]! })

  const { error } = await svc.auth.admin.deleteUser(userId)
  if (error) throw new AppError('INTERNAL', { cause: error })

  return vinculos
}
