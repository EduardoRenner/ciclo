import { ROTAS_AGENDADAS, type RotaDeCron } from '@/core/cron/agendadas'

/**
 * O "dial de autonomia" do `docs/33 §3.1`, em código. Três níveis, nome em português de gente:
 *
 *   1 · Só me avisa   — encontra e mostra; você decide tudo.        (padrão de fábrica)
 *   2 · Deixa pronto  — encontra e PREPARA; você confere e envia.
 *   3 · Faz e me conta— executa e registra.
 *
 * Duas regras que o plano fixou e que este módulo faz valer, não só documenta:
 * - **Padrão de fábrica é sempre 1.** Subir é opt-in explícito, por automação. É o inverso da
 *   degradação silenciosa do `docs/26 §4.4`: aqui, nunca automatizar em silêncio.
 * - **O nível 3 não aparece para automação que não pode chegar lá** (`§3.1`). Dial com posição
 *   que nada alcança é promessa vazia — a mesma classe do quadro "Taxa" sempre zerado que a
 *   auditoria desta base já pegou uma vez.
 */
export const NIVEIS = [1, 2, 3] as const
export type NivelAutonomia = (typeof NIVEIS)[number]

export const NOME_DO_NIVEL: Record<NivelAutonomia, string> = {
  1: 'Só me avisa',
  2: 'Deixa pronto',
  3: 'Faz e me conta',
}

export const EXPLICACAO_DO_NIVEL: Record<NivelAutonomia, string> = {
  1: 'Encontra e mostra na tela. Você decide tudo.',
  2: 'Encontra e deixa a mensagem pronta. Você confere e toca em enviar.',
  3: 'Faz sozinho e registra o que fez.',
}

export type ChaveAutomacao =
  | 'resumo_proativo'
  | 'motor_de_ciclo'
  | 'fidelidade_automatica'
  | 'alertas_de_estoque'
  | 'lembrete_de_agendamento'
  | 'campanha_de_recuperacao'

export type Automacao = {
  chave: ChaveAutomacao
  nome: string
  /** O que ela faz, na voz de quem usa — não na voz de quem programou. */
  descricao: string
  /**
   * Teto de autonomia desta automação, do `docs/33 §2.2`. Nunca é escolha do dono: vem da régua
   * do §2.1 (mensagem para fora / registro de cliente / dinheiro / alcança mais de uma pessoa).
   */
  nivelMaximo: NivelAutonomia
  /** `null` = não depende de rota agendada (roda ao abrir a tela, ou dentro de outra ação). */
  rota: RotaDeCron | null
  /** Automação que o produto não deixa desligar, porque é a base do que ele vende. */
  sempreLigada?: boolean
  /** Por que o teto é esse — aparece na tela quando o dial trava. */
  motivoDoTeto?: string
}

export const AUTOMACOES: readonly Automacao[] = [
  {
    chave: 'motor_de_ciclo',
    nome: 'Motor de Ciclo',
    descricao: 'Calcula quando cada cliente deve voltar e quanto está em risco.',
    nivelMaximo: 1,
    rota: 'recompute-cycles',
    sempreLigada: true,
    motivoDoTeto: 'Só calcula e mostra — nunca fala com a cliente.',
  },
  {
    chave: 'resumo_proativo',
    nome: 'Vale a pena hoje',
    descricao: 'Mostra na tela Hoje quem sumiu, quem faz aniversário e o que está parado.',
    nivelMaximo: 1,
    rota: null,
    sempreLigada: true,
    motivoDoTeto: 'Só mostra na sua tela — nada sai daqui.',
  },
  {
    chave: 'fidelidade_automatica',
    nome: 'Pontos automáticos',
    descricao: 'A cada atendimento concluído, a cliente ganha pontos sem ninguém lançar na mão.',
    nivelMaximo: 3,
    rota: null,
    motivoDoTeto: 'Escreve só na ficha da própria cliente, e não manda mensagem.',
  },
  {
    chave: 'alertas_de_estoque',
    nome: 'Aviso de reposição',
    descricao: 'Avisa quando um produto bate o ponto de recompra.',
    nivelMaximo: 1,
    rota: 'stock-alerts',
    motivoDoTeto: 'comprar é decisão sua, e o CICLO nunca gasta dinheiro por você.',
  },
  {
    chave: 'lembrete_de_agendamento',
    nome: 'Lembrete de horário',
    descricao: 'Lembra a cliente do horário marcado e pede a confirmação.',
    nivelMaximo: 3,
    rota: 'reminders',
    motivoDoTeto: 'Uma cliente por vez, de um horário que ela já marcou.',
  },
  {
    chave: 'campanha_de_recuperacao',
    nome: 'Campanha de recuperação',
    descricao: 'Chama de volta quem passou do tempo de voltar.',
    // Teto 2, e não 3, pela régua (d) do `docs/33 §2.1`: alcança MAIS DE UMA pessoa de uma vez.
    // Um erro que atinge 1 cliente é constrangimento; que atinge 46 é a reputação do salão.
    nivelMaximo: 2,
    rota: 'campaigns',
    motivoDoTeto: 'alcança várias clientes de uma vez, então esta sempre espera seu toque.',
  },
]

export function acharAutomacao(chave: string): Automacao | undefined {
  return AUTOMACOES.find((a) => a.chave === chave)
}

/** Níveis que o dial pode oferecer para esta automação. Nunca passa do teto do catálogo. */
export function niveisDisponiveis(a: Automacao): NivelAutonomia[] {
  return NIVEIS.filter((n) => n <= a.nivelMaximo)
}

/**
 * O nível efetivo, depois de aplicar teto e padrão de fábrica. É esta função — não a tela — que
 * decide: um valor guardado que passe do teto (config antiga, teto que baixou depois, edição
 * manual do JSON) é CORTADO, nunca obedecido.
 */
export function nivelEfetivo(a: Automacao, guardado: unknown): NivelAutonomia {
  const n = typeof guardado === 'number' ? guardado : Number(guardado)
  if (!Number.isInteger(n) || n < 1) return 1
  return Math.min(n, a.nivelMaximo) as NivelAutonomia
}

/**
 * Se a automação de fato ACONTECE hoje. Separa "o dono escolheu" de "o produto consegue" — a
 * distinção que a tela de mensagens errou ao dizer que lembrete saía sozinho enquanto `reminders`
 * estava fora do `schedule`. Aqui a fonte é `ROTAS_AGENDADAS`, a mesma do resto da casa.
 */
export function rodaDeVerdade(a: Automacao): boolean {
  if (a.rota === null) return true
  return ROTAS_AGENDADAS.includes(a.rota)
}
