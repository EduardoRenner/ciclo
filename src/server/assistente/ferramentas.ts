import { z } from 'zod'

import type { ModuloKey } from '@/core/billing/planos'
import { avaliarPermissao, type Papel } from '@/server/auth/rbac'
import { listarAgendamentos } from '@/server/services/agendamentos'
import { listarAlertasDeEstoque } from '@/server/services/alertas-estoque'
import { resumoMensal } from '@/server/services/caixa'
import { buscarCliente, listarClientes } from '@/server/services/clientes'
import { listarAgendaDoDia } from '@/server/services/agendamentos'
import { listarOrcamentos } from '@/server/services/orcamentos'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { resumoDeHoje } from '@/server/services/resumo-hoje'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * docs/26-AGENTE-IA-PLANO.md §3 — catálogo de ferramentas da Fase A, só leitura.
 *
 * Toda ferramenta é um chamador do serviço que já existe, com a MESMA sessão e a MESMA RLS que
 * as telas usam — nunca acessa o banco direto e nunca usa `service_role`. `executar()` devolve
 * um objeto simples (sem classe, sem função) que vira o texto que volta ao modelo: é aqui que
 * mora a regra "número nunca vem do modelo" — o número já vem pronto do serviço, o modelo só lê.
 */

type Cliente = SupabaseClient<Database>

export type ContextoFerramenta = {
  db: Cliente
  tenantId: string
  timezone: string
}

export type Ferramenta<T = unknown> = {
  nome: string
  descricao: string
  schema: z.ZodType<T>
  /** Mesmo formato de `exigirPermissao()` — `server/auth/rbac.ts`. */
  permissao: `${string}:${string}`
  modulo: ModuloKey
  executar: (ctx: ContextoFerramenta, args: T) => Promise<unknown>
}

const EsquemaVazio = z.object({})

const EsquemaClienteId = z.object({
  clientId: z.uuid().describe('id do cliente, obtido antes com a ferramenta buscar_cliente'),
})

const EsquemaBusca = z.object({
  termo: z.string().min(2).describe('nome ou telefone (com ou sem formatação) da cliente a procurar'),
})

// `.optional()`: sem isto, o schema vira `"required": ["mes"]` no JSON Schema que o Gemini lê —
// achado 2026-08-30 testando contra a API real (`docs/32/33` §2.4 item 3, aplicado aqui em
// retrospecto): campo obrigatório sem valor natural na pergunta força o MODELO a inventar um
// valor plausível (uma data de outro ano, por exemplo) só para satisfazer o schema. Opcional de
// verdade deixa o modelo omitir o campo quando a pergunta não especifica período, e o `executar`
// abaixo já tem o fallback certo (mês/dia corrente) para quando isso acontece.
const EsquemaMes = z.object({
  mes: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .describe('mês no formato AAAA-MM; se não informado, usa o mês corrente')
    .optional(),
})

const EsquemaData = z.object({
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('data no formato AAAA-MM-DD; se não informado, usa hoje')
    .optional(),
})

/** `YYYY-MM` do mês corrente no fuso do tenant, sem depender de `new Date()` no chamador. */
function mesCorrente(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' })
    .format(new Date())
    .replace('/', '-')
}

/** Exportada: `assistente.ts` reusa para ancorar o prompt de sistema com a data de hoje. */
export function hojeNoFuso(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
}

/**
 * Apaga o tipo específico de argumento (`T`) de uma ferramenta concreta para o array
 * heterogêneo abaixo — cada ferramenta continua com o schema/executar fortemente tipados entre
 * si (o Zod garante isso em `safeParse`/`executar`); só a COLEÇÃO precisa ser homogênea, e é só
 * aqui, num lugar só, que a variância se resolve. Preferível a `any` espalhado (regra 8 do
 * CLAUDE.md) porque o "esquecimento de tipo" fica contido nesta função, não em cada ferramenta.
 */
function apagarTipo<T>(f: Ferramenta<T>): Ferramenta {
  return f as Ferramenta
}

export const FERRAMENTAS: Ferramenta[] = [
  apagarTipo({
    nome: 'resumo_de_hoje',
    descricao: 'O que está na agenda de hoje: próxima cliente, faturado até agora, confirmações pendentes e alertas de estoque.',
    schema: EsquemaVazio,
    permissao: 'appointment:read',
    modulo: 'agenda',
    executar: async (ctx) => resumoDeHoje(ctx.db, ctx.tenantId, ctx.timezone),
  }),
  apagarTipo({
    nome: 'clientes_para_recuperar',
    descricao: 'Lista de clientes atrasadas para voltar, ordenada pelo valor em risco — o que o Motor de Ciclo já calculou.',
    schema: EsquemaVazio,
    permissao: 'client:read',
    modulo: 'cycle_engine',
    executar: async (ctx) => listarParaRecuperar(ctx.db, ctx.tenantId, { limit: 20 }),
  }),
  apagarTipo({
    nome: 'buscar_cliente',
    descricao: 'Procura clientes pelo nome ou telefone. Use antes de historico_do_cliente para achar o id.',
    schema: EsquemaBusca,
    permissao: 'client:read',
    modulo: 'clients',
    executar: async (ctx, { termo }) => listarClientes(ctx.db, ctx.tenantId, { busca: termo, limite: 10 }),
  }),
  apagarTipo({
    nome: 'historico_do_cliente',
    descricao: 'Dados cadastrais e os últimos agendamentos de uma cliente específica, pelo id.',
    schema: EsquemaClienteId,
    permissao: 'client:read',
    modulo: 'clients',
    executar: async (ctx, { clientId }) => {
      const [cliente, agendamentos] = await Promise.all([
        buscarCliente(ctx.db, ctx.tenantId, clientId),
        listarAgendamentos(ctx.db, ctx.tenantId, { clientId }),
      ])
      // Só os 10 mais recentes voltam ao modelo — histórico inteiro de anos não cabe no
      // contexto e não muda a resposta de "quando ela veio da última vez".
      return { cliente, ultimosAgendamentos: agendamentos.slice(-10).reverse() }
    },
  }),
  apagarTipo({
    nome: 'faturamento_do_periodo',
    descricao: 'Faturamento, custo de material, taxa, comissão e lucro de um mês (AAAA-MM). Vem direto do fechamento de caixa.',
    schema: EsquemaMes,
    permissao: 'report:read',
    modulo: 'register',
    executar: async (ctx, args: z.infer<typeof EsquemaMes> | Record<string, never>) =>
      resumoMensal(ctx.db, ctx.tenantId, ctx.timezone, 'mes' in args && args.mes ? args.mes : mesCorrente(ctx.timezone)),
  }),
  apagarTipo({
    nome: 'ocupacao_do_dia',
    descricao: 'Quantos agendamentos e qual a taxa de ocupação do expediente em um dia (AAAA-MM-DD) — serve para achar horário vago.',
    schema: EsquemaData,
    permissao: 'appointment:read',
    modulo: 'agenda',
    executar: async (ctx, args: z.infer<typeof EsquemaData> | Record<string, never>) => {
      const data = 'data' in args && args.data ? args.data : hojeNoFuso(ctx.timezone)
      const resumo = await listarAgendaDoDia(ctx.db, ctx.tenantId, data, ctx.timezone)
      return { data, quantidadeDeAgendamentos: resumo.appointments.length, taxaDeOcupacao: resumo.occupancyRate, faturamentoPrevistoCents: resumo.forecastCents }
    },
  }),
  apagarTipo({
    nome: 'orcamentos_parados',
    descricao: 'Orçamentos enviados que ainda não foram aprovados nem recusados pela cliente, com quantos dias estão parados.',
    schema: EsquemaVazio,
    permissao: 'appointment:read',
    modulo: 'quotes',
    executar: async (ctx) => {
      const todos = await listarOrcamentos(ctx.db, ctx.tenantId)
      const hoje = Date.now()
      return todos
        .filter((o) => o.status === 'sent')
        .map((o) => ({ ...o, diasParado: Math.floor((hoje - new Date(o.createdAt).getTime()) / 86_400_000) }))
        .sort((a, b) => b.diasParado - a.diasParado)
    },
  }),
  apagarTipo({
    nome: 'alertas_de_estoque',
    descricao: 'Produtos para recomprar ou perto de vencer.',
    schema: EsquemaVazio,
    permissao: 'inventory:read',
    modulo: 'stock',
    executar: async (ctx) => listarAlertasDeEstoque(ctx.db, ctx.tenantId, hojeNoFuso(ctx.timezone)),
  }),
]

/**
 * JSON Schema no formato que o Gemini aceita: sem `$schema` nem `additionalProperties`, que a
 * API rejeita. `z.toJSONSchema` (Zod 4 nativo, sem dependência nova) gera o resto certo.
 */
export function paraJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- os dois só existem para SAIR do objeto (`resto`); nunca lidos.
  const { $schema, additionalProperties, ...resto } = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>
  return resto
}

/**
 * Ferramentas visíveis para um papel, já filtradas por permissão — o modelo nunca vê a que não
 * pode chamar. Reusa `avaliarPermissao()` de `rbac.ts`: mesma tabela de papéis que as rotas
 * usam, não uma segunda cópia da regra.
 */
export function ferramentasPermitidas(papel: Papel): Ferramenta[] {
  return FERRAMENTAS.filter((f) => avaliarPermissao(papel, f.permissao) !== null)
}
