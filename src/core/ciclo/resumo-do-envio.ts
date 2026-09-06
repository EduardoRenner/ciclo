/**
 * O que a tela diz depois de "chamar de volta" — e por que ela não pode chutar o motivo.
 *
 * A frase anterior era uma só, para qualquer coisa que desse errado:
 *
 * > `0 enviada(s), 40 não puderam ser avisadas agora (opt-out ou limite de mensagens).`
 *
 * Ela nomeia duas causas. Nos dois casos mais prováveis de hoje, **nenhuma das duas é a certa**:
 *
 * - o dono clica às 21h30, depois de fechar a loja. Todas caem fora da janela 8h–21h e ele lê que
 *   seus 40 clientes pediram para não receber. A ação certa era esperar até de manhã, e a frase
 *   não deixa ninguém descobrir isso;
 * - sem credencial da Meta configurada — o estado de hoje — a entrega falha para todo mundo, e a
 *   frase é a mesma. Ele conclui que a base inteira deu opt-out e nunca abre chamado sobre o
 *   transporte, que é o que realmente está faltando.
 *
 * Motivo errado é pior que motivo nenhum: manda a pessoa consertar o que não está quebrado.
 *
 * ## Motivo desconhecido tem que aparecer, não sumir
 *
 * `motivoDaRecusa` (login) já paga essa lição numa direção; esta é a outra. Aqui a apresentação lê
 * códigos vindos do servidor, e servidor ganha código novo antes de a tela saber. Contar só os
 * motivos conhecidos faria o total não fechar em silêncio — o mesmo defeito de
 * `cartao-de-confirmacao-em-branco`, onde a origem ganhou chaves e a tela seguiu lendo a lista
 * fixa. Por isso o desconhecido cai numa frase genérica e **entra na conta**: a soma das partes
 * sempre bate com o total, aconteça o que acontecer com os códigos.
 *
 * Sujeito "pessoas" de propósito: é feminino em português para qualquer pessoa, então concorda
 * sem supor o gênero de ninguém.
 */

export type MotivoPulado = 'opt_out' | 'rate_limited' | 'fora_de_janela' | 'falha_de_envio'

const JANELA_INICIO = 8
const JANELA_FIM = 21

/** Cada motivo traz as DUAS conjugações: "1 pessoa já receberam" é o tipo de frase que envelhece mal na tela de quem paga. */
const FRASES: Record<string, { uma: string; varias: string }> = {
  fora_de_janela: {
    uma: `fora do horário de envio (${JANELA_INICIO}h às ${JANELA_FIM}h) — tente de manhã.`,
    varias: `fora do horário de envio (${JANELA_INICIO}h às ${JANELA_FIM}h) — tente de manhã.`,
  },
  rate_limited: {
    uma: 'já recebeu uma mensagem nos últimos 7 dias.',
    varias: 'já receberam uma mensagem nos últimos 7 dias.',
  },
  opt_out: {
    uma: 'pediu para não receber, ou está sem telefone cadastrado.',
    varias: 'pediram para não receber, ou estão sem telefone cadastrado.',
  },
  falha_de_envio: {
    uma: 'não recebeu — tentar de novo agora não resolve.',
    varias: 'não receberam — tentar de novo agora não resolve.',
  },
}

/** Código que esta tela não conhece: sem causa inventada, mas contado. */
const DESCONHECIDO = { uma: 'não foi avisada agora.', varias: 'não foram avisadas agora.' }

function frase(motivo: string, quantas: number): string {
  const forma = FRASES[motivo] ?? DESCONHECIDO
  return quantas === 1 ? `1 pessoa ${forma.uma}` : `${quantas} pessoas ${forma.varias}`
}

/** A ordem é a da ação: primeiro o que a pessoa resolve sozinha, por último o que não depende dela. */
const ORDEM: readonly string[] = ['fora_de_janela', 'rate_limited', 'opt_out', 'falha_de_envio']

/**
 * `motivos` é a lista crua de `skipped[].reason` — uma entrada por pessoa pulada, códigos
 * desconhecidos incluídos.
 */
export function resumoDoEnvio(enviadas: number, motivos: readonly string[]): string {
  if (motivos.length === 0) {
    return `Mensagem enviada para ${enviadas} ${enviadas === 1 ? 'cliente' : 'clientes'}.`
  }

  const contagem = new Map<string, number>()
  for (const motivo of motivos) contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1)

  const conhecidos = ORDEM.filter((m) => contagem.has(m))
  const desconhecidos = [...contagem.keys()].filter((m) => !ORDEM.includes(m)).sort()

  const partes = [...conhecidos, ...desconhecidos].map((m) => frase(m, contagem.get(m) ?? 0))
  const cabeca = enviadas === 0 ? 'Nenhuma mensagem enviada.' : `${enviadas} ${enviadas === 1 ? 'mensagem enviada' : 'mensagens enviadas'}.`

  return [cabeca, ...partes].join(' ')
}
