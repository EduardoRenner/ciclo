/**
 * Para onde cada ação preparada é executada — e por que isto é uma FUNÇÃO por ação, com
 * validação, em vez de um campo `rota` que a ferramenta devolvesse pronto.
 *
 * A proposta nasce de um objeto que passou pelo modelo. Se a tela aceitasse uma URL vinda de lá,
 * o destino da requisição seria influenciável por texto do usuário (ou por dado de terceiro
 * injetado num campo, que é o achado do `docs/26 §4.3`). Aqui o formato da URL é fixo no código;
 * da proposta vem só o id, e ele é validado como UUID antes de entrar na string. É a mesma ideia
 * da régua do `docs/33 §2.1` aplicada ao transporte: limitar o que a coisa ALCANÇA.
 */
import { UUID } from '@/core/text/uuid'

type MontarRota = (dados: Record<string, unknown>) => string | null

const ROTAS: Record<string, MontarRota> = {
  criar_agendamento: () => '/api/v1/appointments',
  concluir_atendimento: (d) => {
    const id = d.appointmentId
    // Id que não é UUID não vira URL: sem isto, `"x/../../outra-coisa"` sairia daqui como rota.
    return typeof id === 'string' && UUID.test(id) ? `/api/v1/appointments/${id}/complete` : null
  },
  adicionar_item_comanda: (d) => {
    const id = d.ticketId
    return typeof id === 'string' && UUID.test(id) ? `/api/v1/tickets/${id}/items` : null
  },
  cadastrar_cliente: () => '/api/v1/clients',
  adicionar_nota: (d) => {
    const id = d.clientId
    return typeof id === 'string' && UUID.test(id) ? `/api/v1/clients/${id}/notes` : null
  },
  // A rota não leva id na URL, mas o corpo leva: id que não é UUID não vira botão.
  chamar_de_volta: (d) =>
    typeof d.clientId === 'string' && UUID.test(d.clientId) && (d.serviceId === undefined || (typeof d.serviceId === 'string' && UUID.test(d.serviceId)))
      ? '/api/v1/cycle/recover/manual'
      : null,
}

/** E.164 de verdade: `+`, sem zero à frente, 10 a 15 dígitos. Qualquer outra coisa não vira destino. */
const E164 = /^\+[1-9]\d{9,14}$/
const MAXIMO_DA_MENSAGEM = 1000

/**
 * O link do "chamar de volta" (docs/84 P2): o WhatsApp do PRÓPRIO dono, com o texto pronto — o mesmo
 * caminho grátis do "Chamar" da tela Recuperar. Mesma régua de `rotaDaAcao`: o HOST é fixo aqui
 * (`wa.me`), e da proposta vem só o número (conferido como E.164) e o texto (codificado). Sem
 * telefone salvo, abre o seletor de contato do próprio WhatsApp — a base trazida de memória não tem
 * telefone, e é justamente a que mais precisa ser chamada.
 */
export function linkDaChamada(dados: Record<string, unknown>): string | null {
  const texto = dados.mensagem
  if (typeof texto !== 'string' || texto.trim() === '' || texto.length > MAXIMO_DA_MENSAGEM) return null
  const tel = dados.telefone
  if (tel === null || tel === undefined) return `https://wa.me/?text=${encodeURIComponent(texto)}`
  if (typeof tel !== 'string' || !E164.test(tel)) return null
  return `https://wa.me/${tel.slice(1)}?text=${encodeURIComponent(texto)}`
}

/** `null` quando a ação é desconhecida ou os dados não formam uma rota válida. */
export function rotaDaAcao(acao: string, dados: Record<string, unknown>): string | null {
  const montar = ROTAS[acao]
  return montar ? montar(dados) : null
}

/** Ações cujo efeito a interface NÃO desfaz — o cartão precisa dizer isso antes do toque. */
const SEM_VOLTA = new Set(['concluir_atendimento'])

export function acaoTemVolta(acao: string): boolean {
  return !SEM_VOLTA.has(acao)
}

/**
 * O que o cartão diz depois do toque. Era "Marcado." para TODA ação — inclusive salvar uma anotação
 * ou cadastrar alguém, onde "marcado" é falso (medido lendo o cartão em 29/09). Ação desconhecida
 * cai num "Feito." neutro, nunca numa palavra que descreve outra coisa.
 */
const FEITO: Record<string, string> = {
  criar_agendamento: 'Marcado.',
  concluir_atendimento: 'Atendimento concluído.',
  adicionar_item_comanda: 'Lançado na comanda.',
  cadastrar_cliente: 'Cadastro feito.',
  adicionar_nota: 'Anotação salva.',
  chamar_de_volta: 'Chamada anotada. Se marcar, a volta conta para o Motor de Ciclo.',
}

/**
 * A chamada de volta responde `{ registrada, motivo }` com 200 mesmo quando NÃO anotou (já chamada
 * nesta semana, saiu da lista). Dizer "anotada" nesses casos prometeria uma volta contada que não
 * vai ser contada.
 */
const NAO_ANOTOU: Record<string, string> = {
  ja_chamada: 'Já estava anotada nesta semana. A mensagem abre do mesmo jeito.',
  sem_ciclo: 'A mensagem abre, mas não conta para o Motor de Ciclo: essa pessoa saiu da lista.',
  opt_out: 'Essa pessoa pediu para não receber mensagem. Nada foi anotado.',
}

export function textoDeFeito(acao: string, resposta?: unknown): string {
  if (acao === 'chamar_de_volta' && typeof resposta === 'object' && resposta !== null && 'registrada' in resposta && resposta.registrada === false) {
    const motivo = 'motivo' in resposta && typeof resposta.motivo === 'string' ? resposta.motivo : ''
    return NAO_ANOTOU[motivo] ?? 'A mensagem abre, mas a chamada não foi anotada.'
  }
  return FEITO[acao] ?? 'Feito.'
}
