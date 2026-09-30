import type { Entendimento, Intencao } from '@/core/inteligencia/entender'
import { semAcento } from '@/core/text/normalizar'

/**
 * MI-7 (docs/85 §5) — o Motor sabe o que falta aprender, sem guardar o que a pessoa escreveu.
 *
 * O plano original dizia "as palavras que sobraram". Não: a frase que o Motor NÃO entende é
 * justamente a que ninguém filtrou, e pode trazer nome de cliente ou dado de saúde ("ela teve
 * reação alérgica?") — e dado de saúde em analytics é a regra 9 do CLAUDE.md. Então o evento não
 * carrega palavra nenhuma da pergunta: só o MOTIVO e um TEMA de uma lista fechada, casado aqui.
 * Uma lista fechada não tem como vazar texto livre.
 *
 * O tema é o que vira o próximo ticket: se "cancelar" aparece toda semana, é a próxima ferramenta.
 */

export type MotivoSemResposta = 'nao_entendi' | 'ambiguo' | 'ainda_nao_sei' | 'fora_do_alcance'

export const TEMAS = [
  'cancelar_ou_remarcar',
  'preco_de_servico',
  'aniversario',
  'mandar_mensagem',
  'comissao',
  'servico_mais_vendido',
  'contagem_de_clientes',
  'comparar_dias',
  'outro',
] as const
export type Tema = (typeof TEMAS)[number]

// Ordem importa: o primeiro que casar vence. Frases, não palavras soltas, onde a palavra sozinha é
// ambígua ("marca" também é agendar; "mais" está em tudo).
const PADROES: ReadonlyArray<readonly [Tema, RegExp]> = [
  ['cancelar_ou_remarcar', /\b(desmarc|cancel|remarc|adia)/],
  ['preco_de_servico', /\b(quanto custa|preco|valor d[oa] |tabela de preco)/],
  ['aniversario', /\baniversari/],
  ['mandar_mensagem', /\b(mand[ae]|envi[ae]|dispar[ae])\b.*\b(mensagem|whats|zap|recado|lembrete)|\bmensagem\b/],
  ['comissao', /\bcomiss/],
  ['servico_mais_vendido', /\b(mais vend|mais procurad|mais pedid|que mais sai)/],
  ['contagem_de_clientes', /\bquant[oa]s? clientes\b/],
  ['comparar_dias', /\b(mais fraco|mais parado|mais vazio|dia mais)/],
]

export type SinalSemResposta = { motivo: MotivoSemResposta; tema?: Tema; intencao?: Intencao }

/** Só o que for motivo de aprender. Pergunta entendida (mesmo que peça um dado a mais) não conta. */
export function sinalSemResposta(ent: Entendimento, texto: string, foraDoAlcance: boolean): SinalSemResposta | null {
  if (foraDoAlcance) return { motivo: 'fora_do_alcance', ...(ent.tipo === 'intencao' ? { intencao: ent.intencao } : {}) }
  if (ent.tipo === 'ambiguo') return { motivo: 'ambiguo' }
  // "Por que caiu?" (MI-5), "e se...?" (MI-6) e o dia extra (procura em dia fechado) são respondidos.
  const t = semAcento(texto)
  if (ent.tipo === 'intencao' && ent.intencao === 'ocupacao' && /\b(mais fraco|mais parado|mais vazio)/.test(t)) {
    return { motivo: 'ainda_nao_sei', tema: 'comparar_dias' }
  }
  if (ent.tipo !== 'nao_entendi') return null
  const tema = PADROES.find(([, re]) => re.test(t))?.[0] ?? 'outro'
  return { motivo: 'nao_entendi', tema }
}
