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
import { regraDaEscritaNaPausa } from '@/core/billing/pausa'
import { lerCortesia, situacaoEmVigor, type SituacaoDaConta } from '@/core/billing/prelancamento'
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
 * O contexto de plano com a situação da conta anexada. `situacao` traz o que a tela precisa para
 * dizer POR QUE o plano é este (cortesia até tal dia, graça, pausada), sem ninguém reler `settings`.
 */
export type ContextoDePlano = ContextoDoTenant & {
  situacao: SituacaoDaConta
  /** O degrau que a pessoa PAGA (`tenants.plan`), sem a cortesia. */
  planoPago: PlanoTier
}

/**
 * Lê plano, eixos e o que o dono desligou. Uma consulta para o tenant e outra para os módulos —
 * as duas por id, com índice, e o resultado é pequeno.
 *
 * **O plano vigente sai daqui e de nenhum outro lugar** (docs/87 §3): `tenants.plan` é o que a
 * pessoa paga, `settings.cortesia` é o que ela ganhou, e o que vale é o maior dos dois enquanto a
 * cortesia estiver em pé — comparado com `agora` a CADA leitura, sem cron e sem escrever nada
 * quando ela acaba. `agora` é injetável só para teste.
 */
export async function contextoDePlano(db: Cliente, tenantId: string, agora: Date = new Date()): Promise<ContextoDePlano> {
  const { data: tenant, error } = await db
    .from('tenants')
    // `cortesia:settings->cortesia` traz só a chave; `settings` inteiro é jsonb que cresce por tenant.
    .select('plan, onde, cobranca, inicio, ritmo, cortesia:settings->cortesia')
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

  const planoPago = normalizarPlano(tenant.plan)
  const situacao = situacaoEmVigor(planoPago, lerCortesia({ cortesia: tenant.cortesia }), agora)

  return {
    // O degrau de LEITURA, não o vigente: na conta pausada ele continua o da cortesia, para nenhuma
    // tela esconder o que já existe. A trava de criar vai em `contaPausada`.
    plano: situacao.planoDeLeitura,
    planoPago,
    situacao,
    eixos,
    desligadosPeloDono: (modulos ?? []).map((m) => m.modulo as ModuloKey),
    ...(situacao.podeEscrever ? {} : { contaPausada: true }),
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
  if (ctx.contaPausada) throw contaPausadaNaoCria()
  const usoAtual = await contar(db, tenantId, recurso)
  const r = verificarLimite(ctx, recurso, usoAtual, aAdicionar)

  if (r.severidade === 'suave' || r.dentro) return

  const alvo = r.precisaDo
  throw new AppError('PLAN_LIMIT', {
    message: alvo
      ? `Seu plano ${NOME_DO_PLANO[ctx.plano]} permite ${r.limite} ${rotulo(recurso, r.limite ?? 0)}. No ${NOME_DO_PLANO[alvo]} você cadastra mais.`
      : `Seu plano ${NOME_DO_PLANO[ctx.plano]} permite ${r.limite} ${rotulo(recurso, r.limite ?? 0)}. Para mais que isso, veja Config → Meu plano.`,
    details: {
      recurso,
      plano: ctx.plano,
      limite: r.limite,
      usoAtual,
      precisaDo: alvo,
    },
  })
}

/**
 * A recusa de quem está na conta pausada (docs/87 D1). `PLAN_LIMIT` (402), o mesmo código do teto,
 * porque a tela de bloqueio já sabe tratá-lo; `details.contaPausada` é o que a distingue de teto.
 */
export function contaPausadaNaoCria(): AppError {
  return new AppError('PLAN_LIMIT', {
    message:
      'Sua cortesia acabou e a conta está pausada: você vê e exporta tudo, mas não cria nada novo. Escolha um plano em Config → Meu plano para voltar na hora.',
    details: { contaPausada: true },
  })
}

/**
 * A trava de pausa de `contextoAtual` (C5). A situação é calculada na leitura, sem cron: a conta
 * pausa na meia-noite certa sem ninguém precisar rodar nada. `agora` é parâmetro porque o teste
 * precisa pôr o relógio em dia de pausa sem esperar até lá.
 */
export function exigirContaQueEscreve(
  metodo: string,
  pathname: string,
  plano: string,
  cortesia: unknown,
  agora: Date = new Date(),
): void {
  const regra = regraDaEscritaNaPausa(metodo, pathname)
  if (regra === 'leitura' || regra === 'permite') return
  if (situacaoEmVigor(normalizarPlano(plano), lerCortesia({ cortesia }), agora).podeEscrever) return
  throw contaPausadaNaoCria()
}

/**
 * C8 (docs/87 D1): a página pública de um negócio pausado diz que o agendamento está indisponível, e
 * as rotas públicas que CRIAM algo no negócio (agendar, pedir orçamento) recusam. Quem recebe o
 * visitante é o negócio, não o CICLO: aceitar agendamento de uma conta que não pode criar deixaria o
 * cliente final marcando horário numa agenda que o dono não consegue mexer.
 *
 * `NOT_FOUND` (e não um código novo) de propósito: toda página pública já trata `NOT_FOUND`, então
 * nenhuma rota nova passa a lançar um erro que ninguém captura. O que distingue é `details.indisponivel`,
 * que só o layout lê para trocar o 404 pela mensagem. O nome e o telefone do negócio já são públicos (a página mostra os dois).
 */
export function negocioEstaPausado(plan: string, settings: unknown, agora: Date = new Date()): boolean {
  return !situacaoEmVigor(normalizarPlano(plan), lerCortesia(settings), agora).podeEscrever
}

export function paginaIndisponivel(nome: string, telefone: string | null = null): AppError {
  return new AppError('NOT_FOUND', {
    message: 'Este negócio não está recebendo agendamentos online agora.',
    details: { indisponivel: true, nome, telefone },
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
