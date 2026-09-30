import { z } from 'zod'

import { resolverPorNome } from '@/core/assistente/resolver'
import { INTENCOES, PISO, type Entendimento, type Entidades, type Intencao } from '@/core/inteligencia/entender'
import type { Chamada, Etapa, Foco } from '@/core/inteligencia/planejar'
import { semAcento } from '@/core/text/normalizar'

/**
 * MI-4 (docs/85 §2.5) — conversa de verdade, sem estado no servidor.
 *
 * O Motor devolve, junto da resposta, um CONTEXTO pequeno: o que entendeu (intenção, período,
 * nomes), a última ferramenta que chamou e, se terminou perguntando "qual delas?", as opções. A
 * tela manda esse contexto de volta com a próxima pergunta. Nada fica guardado no servidor, e
 * nada disso sai do CICLO.
 *
 * O contexto vem do NAVEGADOR, então é entrada não confiável: passa por `EsquemaContexto` (tamanho
 * travado, formas fechadas) e o pior que ele consegue é pedir as mesmas ferramentas que a pessoa já
 * poderia pedir digitando — com a mesma permissão, o mesmo plano e o mesmo Zod na execução.
 *
 * O que ele resolve:
 * - "qual profissional?" → "a Juliana": a mesma chamada de antes, com a escolha no lugar;
 * - "qual delas?" (duas Marias) → "a Silva": abre a ficha da escolhida, pelo id que o Motor achou;
 * - "e no mês passado?", "e amanhã?", "e a Bia?": a mesma pergunta, com o período ou o nome novo;
 * - "por quê?": o porquê SOBRE o que acabou de ser respondido;
 * - "resolve" / "chama ela": a chamada de volta de quem acabou de ser respondido (docs/84 P2).
 */

const Texto = (max: number) => z.string().max(max)

export const EsquemaContexto = z.object({
  intencao: z.enum(INTENCOES),
  periodo: z
    .union([
      z.object({ tipo: z.literal('dia'), data: z.iso.date() }),
      z.object({ tipo: z.literal('intervalo'), inicio: z.iso.date(), fim: z.iso.date() }),
      z.object({ tipo: z.literal('mes'), mes: z.string().regex(/^\d{4}-\d{2}$/) }),
    ])
    .optional(),
  hora: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  trechos: z.array(z.object({ antes: Texto(40).nullable(), palavras: z.array(Texto(60)).max(8) })).max(6),
  chamada: z.object({ nome: Texto(60), argumentos: z.record(Texto(40), z.union([Texto(2000), z.number()])) }).optional(),
  foco: z
    .enum([
      'atendido_do_dia', 'confirmacoes', 'visao_do_dia', 'quem_primeiro', 'estimativa_de_recuperacao', 'sumidos_ha_dias',
      'lista_de_recuperacao', 'telefone', 'quanto_deixou', 'ultima_visita', 'costume', 'sobra_do_mes', 'caixa_do_mes',
    ] satisfies Foco[])
    .optional(),
  pendente: z
    .object({
      oQue: z.enum(['pessoa', 'profissional', 'servico', 'produto', 'item', 'cliente', 'atendimento', 'comanda']),
      opcoes: z.array(z.object({ id: z.uuid().optional(), nome: Texto(120) })).min(2).max(10),
    })
    .optional(),
})
export type ContextoDaConversa = z.infer<typeof EsquemaContexto>

/** Lê o que veio do navegador. Qualquer coisa fora da forma vira "sem contexto", nunca erro. */
export function lerContexto(bruto: unknown): ContextoDaConversa | null {
  const r = EsquemaContexto.safeParse(bruto)
  return r.success ? r.data : null
}

export type Lembranca = {
  /** O entendimento que vale para esta pergunta, já com o que veio da anterior. */
  ent: Entendimento
  /** Quando a pergunta só respondia um "qual delas?": a chamada pronta, sem planejar de novo. */
  chamadaDireta?: Chamada
  /** O foco herdado, quando esta pergunta continua a anterior. */
  foco?: Foco
}

const ARGUMENTO_DO_PENDENTE: Record<string, string> = {
  profissional: 'profissional',
  servico: 'servico',
  produto: 'item',
  item: 'item',
  cliente: 'cliente',
  pessoa: 'cliente',
  atendimento: 'cliente',
  comanda: 'cliente',
}

const CORTESIA: ReadonlySet<Intencao> = new Set(['saudacao', 'ajuda'])

function perguntaCompleta(ent: Entendimento): boolean {
  return ent.tipo === 'intencao' && !CORTESIA.has(ent.intencao) && ent.pontos >= PISO
}

/** O texto da resposta a um "qual delas?", sem o artigo: "a Juliana" → "Juliana". */
function termoDaEscolha(ent: Entendimento, texto: string): string {
  const doResto = ent.entidades.resto.join(' ').trim()
  return doResto || semAcento(texto).replace(/^(a|o|e|da|do|com a|com o)\s+/, '').trim()
}

export function lembrar(atual: Entendimento, ctx: ContextoDaConversa | null, texto: string): Lembranca {
  if (!ctx) return { ent: atual }

  // 1. Resposta a um "qual delas?".
  if (ctx.pendente && !perguntaCompleta(atual)) {
    const termo = termoDaEscolha(atual, texto)
    const escolha = termo ? resolverPorNome(termo, ctx.pendente.opcoes.map((o) => ({ id: o.id ?? o.nome, nome: o.nome }))) : null
    if (escolha?.tipo === 'achou') {
      const ent: Entendimento = { tipo: 'intencao', intencao: ctx.intencao, pontos: PISO, entidades: entidadesDoContexto(ctx) }
      const opcao = ctx.pendente.opcoes.find((o) => (o.id ?? o.nome) === escolha.item.id)!
      const foco = ctx.foco ? { foco: ctx.foco } : {}
      if (ctx.pendente.oQue === 'pessoa' && opcao.id) return { ent, ...foco, chamadaDireta: { nome: 'historico_do_cliente', argumentos: { clientId: opcao.id } } }
      const chave = ARGUMENTO_DO_PENDENTE[ctx.pendente.oQue]
      if (ctx.chamada && chave) return { ent, ...foco, chamadaDireta: { nome: ctx.chamada.nome, argumentos: { ...ctx.chamada.argumentos, [chave]: opcao.nome } } }
    }
  }

  // 2. "Por quê?" sozinho: o porquê do que acabou de ser respondido — do MESMO período. Sem herdar o
  // período, "quanto faturei em agosto?" → "por quê?" explicava setembro (pego pelo teste do MI-5).
  if (atual.tipo === 'intencao' && atual.intencao === 'por_que' && !atual.sobre && !CORTESIA.has(ctx.intencao)) {
    const periodo = atual.entidades.periodo ?? ctx.periodo
    return { ent: { ...atual, sobre: ctx.intencao, entidades: { ...atual.entidades, ...(periodo ? { periodo } : {}) } } }
  }

  // 3. "Resolve" / "chama ela" sem nome: vale a pessoa (ou a lista) que acabou de ser respondida.
  if (atual.tipo === 'intencao' && atual.intencao === 'chamar_de_volta' && atual.entidades.trechos.length === 0) {
    if (ctx.chamada?.nome === 'clientes_para_recuperar') return { ent: atual, chamadaDireta: { nome: 'clientes_para_recuperar', argumentos: {} } }
    const clientId = ctx.chamada?.nome === 'historico_do_cliente' ? ctx.chamada.argumentos.clientId : undefined
    if (typeof clientId === 'string') return { ent: atual, chamadaDireta: { nome: 'preparar_chamada_de_volta', argumentos: { clientId } } }
  }

  // 4. Continuação: a frase nova só traz período, hora ou nome — "e no mês passado?", "e a Bia?".
  const e = atual.entidades
  const trazAlgo = e.periodo !== undefined || e.hora !== undefined || e.trechos.length > 0
  if (!perguntaCompleta(atual) && atual.tipo !== 'ambiguo' && trazAlgo && !CORTESIA.has(ctx.intencao)) {
    const doContexto = entidadesDoContexto(ctx)
    return {
      ...(ctx.foco ? { foco: ctx.foco } : {}),
      ent: {
        tipo: 'intencao',
        intencao: ctx.intencao,
        pontos: PISO,
        entidades: {
          periodo: e.periodo ?? doContexto.periodo,
          hora: e.hora ?? doContexto.hora,
          // Nome novo substitui o antigo ("e a Bia?"); sem nome novo, vale o de antes ("e amanhã?").
          trechos: e.trechos.length > 0 ? e.trechos : doContexto.trechos,
          resto: e.trechos.length > 0 ? e.resto : doContexto.resto,
          ...(e.valorCents !== undefined ? { valorCents: e.valorCents } : {}),
          ...(e.percentualBps !== undefined ? { percentualBps: e.percentualBps } : {}),
        },
      },
    }
  }

  return { ent: atual }
}

function entidadesDoContexto(ctx: ContextoDaConversa): Entidades {
  return {
    ...(ctx.periodo ? { periodo: ctx.periodo } : {}),
    ...(ctx.hora ? { hora: ctx.hora } : {}),
    trechos: ctx.trechos,
    resto: ctx.trechos.flatMap((t) => t.palavras),
  }
}

// ---------------------------------------------------------------------------------------------

const Preparo = z.object({ status: z.string(), oQue: z.string().optional(), opcoes: z.array(z.string()).optional() })
const Clientes = z.array(z.object({ id: z.string(), name: z.string() }))

function lerJson(bruto: string): unknown {
  try {
    return JSON.parse(bruto)
  } catch {
    return null
  }
}

/**
 * O contexto que esta resposta deixa para a próxima pergunta. `null` quando não há o que lembrar
 * (não entendeu, empate, cortesia) — a próxima pergunta começa do zero, que é o certo.
 */
export function contextoParaDepois(ent: Entendimento, etapas: ReadonlyArray<Etapa>, foco?: Foco, argumentos?: { termo?: string }): ContextoDaConversa | null {
  if (ent.tipo !== 'intencao' || CORTESIA.has(ent.intencao)) return null
  const ultima = etapas[etapas.length - 1]

  let pendente: ContextoDaConversa['pendente']
  if (ultima?.chamada.nome === 'buscar_cliente') {
    const lista = Clientes.safeParse(lerJson(ultima.resultado))
    const termo = typeof ultima.chamada.argumentos.termo === 'string' ? ultima.chamada.argumentos.termo : (argumentos?.termo ?? '')
    if (lista.success) {
      const r = resolverPorNome(termo, lista.data.map((c) => ({ id: c.id, nome: c.name })))
      if (r.tipo === 'ambiguo') pendente = { oQue: 'pessoa', opcoes: r.opcoes.slice(0, 10).map((o) => ({ id: o.id, nome: o.nome })) }
    }
  } else if (ultima?.chamada.nome.startsWith('preparar_')) {
    const r = Preparo.safeParse(lerJson(ultima.resultado))
    const oQue = r.success ? r.data.oQue : undefined
    if (r.success && r.data.status === 'qual_delas' && oQue && oQue in ARGUMENTO_DO_PENDENTE && (r.data.opcoes?.length ?? 0) >= 2) {
      pendente = { oQue: oQue as NonNullable<ContextoDaConversa['pendente']>['oQue'], opcoes: r.data.opcoes!.slice(0, 10).map((nome) => ({ nome: nome.slice(0, 120) })) }
    }
  }

  const candidato = {
    intencao: ent.intencao,
    ...(ent.entidades.periodo ? { periodo: ent.entidades.periodo } : {}),
    ...(ent.entidades.hora ? { hora: ent.entidades.hora } : {}),
    trechos: ent.entidades.trechos.slice(0, 6).map((t) => ({ antes: t.antes, palavras: t.palavras.slice(0, 8) })),
    ...(ultima ? { chamada: { nome: ultima.chamada.nome, argumentos: soArgumentosSimples(ultima.chamada.argumentos) } } : {}),
    ...(pendente ? { pendente } : {}),
    ...(foco ? { foco } : {}),
  }
  // Passa pelo MESMO esquema da volta: o que não caberia na volta não sai na ida.
  return lerContexto(candidato)
}

function soArgumentosSimples(args: Record<string, unknown>): Record<string, string | number> {
  const saida: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(args)) if (typeof v === 'string' || typeof v === 'number') saida[k] = v
  return saida
}
