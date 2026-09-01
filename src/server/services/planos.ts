import {
  NOME_DO_PLANO,
  PLANOS,
  VALORES_POR_EIXO,
  podeUsarCapacidade,
  podeUsarModulo,
  verificarLimite,
  type Capacidade,
  type ContextoDoTenant,
  type Eixo,
  type ModuloKey,
  type PlanoTier,
  type Recurso,
  type ValorDoEixo,
} from '@/core/billing/planos'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * docs/18-MONETIZACAO-PLANO.md §L.1: **o limite é sempre no servidor.** Esconder botão não é
 * limite — quem sabe abrir o DevTools ou chamar a API direto passa por cima de qualquer regra
 * que só exista na tela.
 *
 * A regra em si mora em `core/billing/planos.ts`, que é pura e testada. Este arquivo só traz os
 * fatos do banco e traduz o veredito em `AppError`. É a mesma divisão do resto do projeto
 * (regra 5 do CLAUDE.md): `core/` decide, `server/` busca e responde.
 */

/**
 * Nomes que o enum `plan_tier` teve antes da migration 0040. Existem porque código e migration
 * não sobem no mesmo instante: entre o deploy e o `supabase db push` o banco ainda responde os
 * nomes velhos, e `PLANOS['pro']` seria `undefined` — um crash em vez de um bloqueio.
 *
 * Sai quando não houver mais ambiente com schema anterior à 0040.
 */
const NOMES_ANTIGOS: Record<string, PlanoTier> = {
  pro: 'essencial',
  profissional: 'equipe',
}

/**
 * Nunca confia cegamente no que veio da coluna. Valor desconhecido cai para `gratis` — o degrau
 * mais restrito — porque errar para menos bloqueia uma ação (recuperável, e a pessoa reclama)
 * e errar para mais libera o que não foi pago (silencioso, e ninguém reclama).
 */
export function normalizarPlano(valor: string): PlanoTier {
  if (valor in PLANOS) return valor as PlanoTier
  const antigo = NOMES_ANTIGOS[valor]
  if (antigo) return antigo
  console.warn(JSON.stringify({ level: 'warn', event: 'plano_desconhecido', valor }))
  return 'gratis'
}

/**
 * Os quatro eixos são `text` com `check` no banco, não enum do Postgres — então `types.gen.ts` os
 * entrega como `string` e o `tsc` não confere nada sozinho (foi assim que `inicio === 'orcamento'`
 * sobreviveu). Esta função é a borda: o valor entra `string` e sai como a união do eixo.
 *
 * Valor desconhecido vira `null`, e `null` não esconde módulo nenhum. É de propósito, pelo mesmo
 * raciocínio invertido do `normalizarPlano`: ali errar para menos bloqueia uma ação recuperável;
 * aqui errar para menos **some com a funcionalidade da tela** sem dizer por quê — que é justamente
 * o defeito que esta rodada consertou. Diante de um valor que não reconheço, não escondo.
 */
export function normalizarEixo<E extends Eixo>(eixo: E, valor: string | null): ValorDoEixo[E] | null {
  if (valor == null) return null
  if ((VALORES_POR_EIXO[eixo] as readonly string[]).includes(valor)) return valor as ValorDoEixo[E]
  console.warn(JSON.stringify({ level: 'warn', event: 'eixo_desconhecido', eixo, valor }))
  return null
}

/**
 * Lê plano, eixos e o que o dono desligou. Uma consulta para o tenant e outra para os módulos —
 * as duas por id, com índice, e o resultado é pequeno.
 */
export async function contextoDePlano(db: Cliente, tenantId: string): Promise<ContextoDoTenant> {
  const { data: tenant, error } = await db
    .from('tenants')
    .select('plan, onde, cobranca, inicio, ritmo')
    .eq('id', tenantId)
    .single()
  if (error) throw new AppError('INTERNAL', { cause: error })

  const { data: modulos, error: erroModulos } = await db
    .from('tenant_modules')
    .select('modulo, ligado, origem')
    .eq('tenant_id', tenantId)
    .eq('origem', 'dono')
    .eq('ligado', false)
  if (erroModulos) throw new AppError('INTERNAL', { cause: erroModulos })

  const eixos: ContextoDoTenant['eixos'] = {
    onde: normalizarEixo('onde', tenant.onde),
    cobranca: normalizarEixo('cobranca', tenant.cobranca),
    inicio: normalizarEixo('inicio', tenant.inicio),
    ritmo: normalizarEixo('ritmo', tenant.ritmo),
  }

  return {
    plano: normalizarPlano(tenant.plan),
    eixos,
    desligadosPeloDono: (modulos ?? []).map((m) => m.modulo as ModuloKey),
  }
}

/**
 * Ramos separados de propósito: `professionals` tem `active` e `clients` não, e um construtor de
 * consulta compartilhado entre as duas tabelas perde o tipo da coluna. Soft delete não conta em
 * nenhuma das duas — quem excluiu não deveria continuar ocupando vaga.
 */
async function contar(db: Cliente, tenantId: string, recurso: Recurso): Promise<number> {
  if (recurso === 'profissionais') {
    // Profissional inativo não ocupa vaga: quem desligou alguém da equipe não deveria continuar
    // pagando por isso, e reativar volta a contar (e volta a poder esbarrar no teto).
    const { count, error } = await db
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
    if (error) throw new AppError('INTERNAL', { cause: error })
    return count ?? 0
  }

  const { count, error } = await db
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return count ?? 0
}

/**
 * Recusa a criação quando o limite é **duro**. Limite suave (cliente) nunca recusa — ele devolve
 * o aviso para a tela mostrar, porque travar cadastro de cliente no meio de um atendimento é a
 * forma mais rápida de o salão abandonar o sistema (§L.1, e a mesma lógica da armadilha de
 * estoque no CLAUDE.md).
 *
 * `details` leva o que a tela de bloqueio precisa para ser específica em vez de genérica: quanto
 * é o teto, quanto já existe e qual degrau resolve.
 */
export async function exigirLimite(
  db: Cliente,
  tenantId: string,
  recurso: Recurso,
  aAdicionar = 1,
): Promise<void> {
  const ctx = await contextoDePlano(db, tenantId)
  const usoAtual = await contar(db, tenantId, recurso)
  const r = verificarLimite(ctx, recurso, usoAtual, aAdicionar)

  if (r.severidade === 'suave' || r.dentro) return

  const alvo = r.precisaDo
  throw new AppError('PLAN_LIMIT', {
    message: alvo
      ? `Seu plano ${NOME_DO_PLANO[ctx.plano]} permite ${r.limite} ${rotulo(recurso, r.limite ?? 0)}. No ${NOME_DO_PLANO[alvo]} você cadastra mais.`
      : `Seu plano ${NOME_DO_PLANO[ctx.plano]} permite ${r.limite} ${rotulo(recurso, r.limite ?? 0)}.`,
    details: {
      recurso,
      plano: ctx.plano,
      limite: r.limite,
      usoAtual,
      precisaDo: alvo,
    },
  })
}

function rotulo(recurso: Recurso, quantidade: number): string {
  const um = quantidade === 1
  return recurso === 'profissionais' ? (um ? 'profissional' : 'profissionais') : um ? 'cliente' : 'clientes'
}

/** Recusa quando o módulo não está liberado. `fora_do_eixo` também recusa — só que sem oferecer upgrade. */
export async function exigirModulo(db: Cliente, tenantId: string, modulo: ModuloKey): Promise<void> {
  const ctx = await contextoDePlano(db, tenantId)
  const v = podeUsarModulo(ctx, modulo)
  if (v.estado === 'liberado') return

  if (v.estado === 'bloqueado_pelo_plano') {
    throw new AppError('PLAN_LIMIT', {
      message: `Isso faz parte do plano ${NOME_DO_PLANO[v.precisaDo]}.`,
      details: { modulo, plano: ctx.plano, precisaDo: v.precisaDo },
    })
  }

  // Fora do eixo ou desligado pelo dono não é questão de dinheiro — não ofereça upgrade para
  // resolver, porque upgrade não resolve.
  throw new AppError('FORBIDDEN', {
    message:
      v.estado === 'desligado_pelo_dono'
        ? 'Esse recurso está desligado nas configurações do seu negócio.'
        : 'Esse recurso não se aplica ao tipo de atendimento do seu negócio.',
    details: { modulo, estado: v.estado },
  })
}

export async function exigirCapacidade(db: Cliente, tenantId: string, capacidade: Capacidade): Promise<void> {
  const ctx = await contextoDePlano(db, tenantId)
  const v = podeUsarCapacidade(ctx, capacidade)
  if (v.estado === 'liberado') return

  const alvo = v.estado === 'bloqueado_pelo_plano' ? v.precisaDo : null
  throw new AppError('PLAN_LIMIT', {
    message: alvo ? `Isso faz parte do plano ${NOME_DO_PLANO[alvo]}.` : 'Seu plano não inclui esse recurso.',
    details: { capacidade, plano: ctx.plano, precisaDo: alvo },
  })
}
