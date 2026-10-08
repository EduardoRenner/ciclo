/**
 * "O que falta de você" (docs/101 §2.9 do anexo 01, T1.3): as pendências de um caso nascem de um
 * MODELO por tipo de caso, com datas relativas em dias úteis, e andam por estados com motivo.
 * Pura e sem relógio: o "hoje" e os dias não contáveis entram por argumento.
 *
 * O desenho vem do `client_actions` do LUBI (`0021:85-123`, estados, rodada, escada de lembretes),
 * mais o que o LUBI só planejou (`11` §4, `workflow_templates`): o modelo versionado, que nunca mexe
 * em caso já aberto.
 */
import { addDays, diaDaSemana } from './datas'
import type { DiaNaoContavel } from './prazo-calculo'

export const TIPOS_DE_CASO = [
  'holding',
  'inventario',
  'planejamento_sucessorio',
  'divorcio_partilha',
  'contrato',
  'societario',
  'tributario',
  'trabalhista',
  'civel',
  'outro',
] as const
export type TipoDeCaso = (typeof TIPOS_DE_CASO)[number]

/** Como o tipo aparece na tela, e a frase que o cliente lê por padrão (o escritório pode trocar). */
export const ROTULO_DO_TIPO_DE_CASO: Readonly<Record<TipoDeCaso, { rotulo: string; paraCliente: string }>> = {
  holding: { rotulo: 'Holding', paraCliente: 'o planejamento da família' },
  inventario: { rotulo: 'Inventário', paraCliente: 'o inventário' },
  planejamento_sucessorio: { rotulo: 'Planejamento sucessório', paraCliente: 'o planejamento sucessório' },
  divorcio_partilha: { rotulo: 'Divórcio e partilha', paraCliente: 'a partilha' },
  contrato: { rotulo: 'Contrato', paraCliente: 'o contrato' },
  societario: { rotulo: 'Societário', paraCliente: 'a alteração da empresa' },
  tributario: { rotulo: 'Tributário', paraCliente: 'o seu processo' },
  trabalhista: { rotulo: 'Trabalhista', paraCliente: 'o seu processo' },
  civel: { rotulo: 'Cível', paraCliente: 'o seu processo' },
  outro: { rotulo: 'Outro', paraCliente: 'o seu atendimento' },
}

export type TipoDePendencia = 'enviar_documento' | 'assinar' | 'responder' | 'conferir' | 'agendar'
export type QuemDeve = 'cliente' | 'equipe'
export type Urgencia = 'alta' | 'media' | 'baixa'

export interface PassoDoModelo {
  titulo: string
  tipo: TipoDePendencia
  quemDeve: QuemDeve
  /** Dias úteis depois da abertura do caso. 0 = no próprio dia útil da abertura. */
  diasUteis: number
  urgencia?: Urgencia
  /** Categoria de documento esperada (lista de `legal_documents.category`). */
  categoria?: string
}

export interface ModeloDeChecklist {
  tipoDeCaso: TipoDeCaso
  versao: number
  passos: readonly PassoDoModelo[]
}

export type EstadoDaPendencia = 'rascunho' | 'pendente' | 'recebido' | 'em_conferencia' | 'concluido' | 'devolvido' | 'cancelado'

export interface PendenciaGerada {
  posicao: number
  titulo: string
  tipo: TipoDePendencia
  quemDeve: QuemDeve
  urgencia: Urgencia
  categoria: string | null
  venceEm: string
  estado: EstadoDaPendencia
  rodada: number
}

const fimDeSemana = (iso: string) => {
  const w = diaDaSemana(iso)
  return w === 0 || w === 6
}

/** O primeiro dia útil a partir de `iso` (ele mesmo, se já for útil). */
export function diaUtilAPartirDe(iso: string, naoContaveis: ReadonlySet<string>): string {
  let d = iso
  for (let i = 0; i < 800; i++) {
    if (!fimDeSemana(d) && !naoContaveis.has(d)) return d
    d = addDays(d, 1)
  }
  throw new RangeError('Não há dia útil à vista: confira o cadastro de feriados.')
}

/** `n` dias úteis depois de `iso` (n = 0 devolve o próprio dia útil). */
export function somarDiasUteis(iso: string, n: number, naoContaveis: ReadonlySet<string>): string {
  if (!Number.isInteger(n) || n < 0 || n > 365) throw new RangeError('O prazo do passo deve ser de 0 a 365 dias úteis.')
  let d = diaUtilAPartirDe(iso, naoContaveis)
  for (let i = 0; i < n; i++) d = diaUtilAPartirDe(addDays(d, 1), naoContaveis)
  return d
}

/**
 * As pendências de um caso novo, do modelo. Quem cria com `estagio` (docs/101 §3.4) gera tudo em
 * `rascunho`: a advocacia aprova antes de o cliente ser cobrado. O resto nasce `pendente`.
 */
export function gerarPendencias(
  modelo: ModeloDeChecklist,
  abertoEm: string,
  naoContaveis: readonly DiaNaoContavel[],
  opcoes: { criadoPorEstagio?: boolean } = {},
): PendenciaGerada[] {
  const nao = new Set(naoContaveis.map((d) => d.data))
  return modelo.passos.map((p, i) => ({
    posicao: i + 1,
    titulo: p.titulo,
    tipo: p.tipo,
    quemDeve: p.quemDeve,
    urgencia: p.urgencia ?? 'media',
    categoria: p.categoria ?? null,
    venceEm: somarDiasUteis(abertoEm, p.diasUteis, nao),
    estado: opcoes.criadoPorEstagio ? 'rascunho' : 'pendente',
    rodada: 1,
  }))
}

// ---------------------------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------------------------

export type AcaoNaPendencia = 'aprovar' | 'receber' | 'conferir' | 'concluir' | 'devolver' | 'cancelar'

const TRANSICOES: Readonly<Record<AcaoNaPendencia, { de: readonly EstadoDaPendencia[]; para: EstadoDaPendencia; exigeMotivo: boolean }>> = {
  aprovar: { de: ['rascunho'], para: 'pendente', exigeMotivo: false },
  receber: { de: ['pendente', 'devolvido'], para: 'recebido', exigeMotivo: false },
  conferir: { de: ['recebido'], para: 'em_conferencia', exigeMotivo: false },
  concluir: { de: ['recebido', 'em_conferencia', 'pendente'], para: 'concluido', exigeMotivo: false },
  devolver: { de: ['recebido', 'em_conferencia'], para: 'devolvido', exigeMotivo: true },
  cancelar: { de: ['rascunho', 'pendente', 'devolvido', 'recebido', 'em_conferencia'], para: 'cancelado', exigeMotivo: true },
}

export type ResultadoDaTransicao =
  | { ok: true; estado: EstadoDaPendencia; rodada: number; zerarLembretes: boolean }
  | { ok: false; motivo: string }

/**
 * Aplica uma ação. Devolver abre RODADA nova (o lembrete recomeça do zero: é outro pedido). Motivo é
 * obrigatório onde a decisão precisa ser explicada depois (devolver, cancelar), e só espaço não vale.
 */
export function transicionar(
  atual: { estado: EstadoDaPendencia; rodada: number },
  acao: AcaoNaPendencia,
  motivo: string | null = null,
): ResultadoDaTransicao {
  const t = TRANSICOES[acao]
  if (!t.de.includes(atual.estado)) {
    return { ok: false, motivo: `Não dá para ${ROTULO_DA_ACAO[acao]} uma pendência ${ROTULO_DO_ESTADO[atual.estado]}.` }
  }
  if (t.exigeMotivo && (motivo ?? '').trim().length < 5) {
    return { ok: false, motivo: 'Escreva o motivo (pelo menos 5 letras): ele fica no histórico.' }
  }
  const novaRodada = acao === 'devolver'
  return { ok: true, estado: t.para, rodada: novaRodada ? atual.rodada + 1 : atual.rodada, zerarLembretes: novaRodada }
}

const ROTULO_DA_ACAO: Record<AcaoNaPendencia, string> = {
  aprovar: 'aprovar',
  receber: 'marcar como recebida',
  conferir: 'conferir',
  concluir: 'concluir',
  devolver: 'devolver',
  cancelar: 'cancelar',
}

const ROTULO_DO_ESTADO: Record<EstadoDaPendencia, string> = {
  rascunho: 'em rascunho',
  pendente: 'pendente',
  recebido: 'recebida',
  em_conferencia: 'em conferência',
  concluido: 'concluída',
  devolvido: 'devolvida',
  cancelado: 'cancelada',
}

// ---------------------------------------------------------------------------------------------
// Escada de lembretes (o sistema PREPARA; a pessoa envia)
// ---------------------------------------------------------------------------------------------

/** D0 e D+3, D+7 em dias corridos desde a rodada; em D+10 a mensagem vira tarefa de ligar. */
export const MARCOS_DO_LEMBRETE = [0, 3, 7] as const
export const MARCO_DE_LIGAR = 10

export type ProximoPasso = { tipo: 'mensagem'; marco: number } | { tipo: 'ligar' } | { tipo: 'nada' }

/**
 * O que preparar hoje para uma pendência do cliente. Marco é "chegou ou passou" (`>=`), nunca
 * igualdade: se o job parar um dia, o marco perdido sai no dia seguinte, uma vez (regra do LUBI,
 * `06` §0). `jaPreparados` são os marcos desta rodada que já viraram mensagem.
 */
export function proximoLembrete(
  p: { estado: EstadoDaPendencia; quemDeve: QuemDeve; rodadaDesde: string; jaPreparados: readonly number[]; ligarJaCriado: boolean },
  hoje: string,
): ProximoPasso {
  if (p.quemDeve !== 'cliente' || (p.estado !== 'pendente' && p.estado !== 'devolvido')) return { tipo: 'nada' }
  const [ya, ma, da] = p.rodadaDesde.split('-').map(Number) as [number, number, number]
  const [yb, mb, db] = hoje.split('-').map(Number) as [number, number, number]
  const dias = Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
  if (dias >= MARCO_DE_LIGAR) return p.ligarJaCriado ? { tipo: 'nada' } : { tipo: 'ligar' }
  // o maior marco alcançado que ainda não saiu: atraso de vários dias não gera rajada de mensagens
  const alcancados = MARCOS_DO_LEMBRETE.filter((m) => dias >= m && !p.jaPreparados.includes(m))
  const marco = alcancados.at(-1)
  return marco === undefined ? { tipo: 'nada' } : { tipo: 'mensagem', marco }
}
