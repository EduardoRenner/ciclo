import { NOMES_DOS_ITENS, type ItemDoPet, type VencimentoDoPet } from './protocolo'

/**
 * A mensagem do pet (`docs/105-ciclo/C-012`, serviço como software), no molde da mensagem do
 * automotivo (C-007): diz o MOTIVO que o tutor confere na carteirinha, não "faz tempo que não vem".
 *
 * Regras:
 * - item que cabe num banho já marcado não vira ida extra: "no banho de sexta dá pra aplicar";
 * - vacina só é OFERECIDA por quem aplica (`aplicaVacina`); pet shop sem veterinário lembra o tutor de
 *   combinar com o veterinário dele — oferecer o que a casa não faz é promessa vazia;
 * - item sem registro pede para conferir a carteirinha, nunca diz "venceu";
 * - no máximo 3 motivos, o resto contado; sem promessa de canal e sem pressão de venda;
 * - não supõe gênero do tutor nem do animal ("de Thor", não "do Thor").
 */

export type EntradaDaMensagemDoPet = {
  nomeDoTutor: string
  nomeDoAnimal: string
  nomeDoNegocio: string
  vencimentos: readonly VencimentoDoPet[]
  /** O banho já marcado, formatado no fuso do negócio ("sexta, 17/10"), e os itens que cabem nele. */
  banhoMarcado?: { quando: string; itens: readonly ItemDoPet[] } | null
  aplicaVacina: boolean
}

export const MAXIMO_DE_MOTIVOS = 3

const VACINAS: readonly ItemDoPet[] = ['vacina_polivalente', 'antirrabica']

function urgencia(v: VencimentoDoPet): number {
  return v.estado === 'vencido' ? 0 : v.estado === 'nesta_visita' ? 1 : 2
}

function linha(v: VencimentoDoPet, aplicaVacina: boolean): string {
  const nome = NOMES_DOS_ITENS[v.item]
  if (v.estado === 'perguntar') return `${nome}: não temos o registro, vale conferir a carteirinha`
  const quando = v.estado === 'vencido' ? 'já está na data' : 'está chegando na data'
  const naoAplica = VACINAS.includes(v.item) && !aplicaVacina ? ' (vale combinar com o veterinário)' : ''
  return `${nome} (${v.motivo}): ${quando}${naoAplica}`
}

export function mensagemDoPet(e: EntradaDaMensagemDoPet): string {
  const relevantes = e.vencimentos.filter((v) => v.estado !== 'em_dia').sort((a, b) => urgencia(a) - urgencia(b))
  if (relevantes.length === 0) return ''

  const noBanho = new Set(e.banhoMarcado?.itens ?? [])
  // Vacina só "cabe no banho" se a casa aplica vacina.
  const cabem = relevantes.filter((v) => noBanho.has(v.item) && (aplicaOItem(v.item, e.aplicaVacina)))
  const resto = relevantes.filter((v) => !cabem.includes(v))

  const partes: string[] = [`Oi, ${e.nomeDoTutor}! Aqui é da ${e.nomeDoNegocio}.`]
  let mostrados = 0
  if (cabem.length > 0 && e.banhoMarcado) {
    const nomes = cabem.slice(0, MAXIMO_DE_MOTIVOS).map((v) => `${NOMES_DOS_ITENS[v.item]} (${v.motivo})`)
    mostrados += nomes.length
    partes.push(`No banho de ${e.nomeDoAnimal} (${e.banhoMarcado.quando}) dá pra aproveitar e fazer: ${nomes.join(', ')}.`)
  }
  const linhas = resto.slice(0, Math.max(0, MAXIMO_DE_MOTIVOS - mostrados)).map((v) => `• ${linha(v, e.aplicaVacina)}`)
  mostrados += linhas.length
  if (linhas.length > 0) partes.push(`${cabem.length > 0 ? 'E pela carteirinha' : `Pela carteirinha de ${e.nomeDoAnimal}`}:\n${linhas.join('\n')}`)
  const sobra = relevantes.length - mostrados
  if (sobra > 0) partes.push(`• e mais ${sobra} ${sobra === 1 ? 'item' : 'itens'} para ver no balcão`)
  partes.push(e.banhoMarcado ? 'Quer que a gente já deixe separado?' : 'Quer marcar um horário?')
  return partes.join('\n')
}

function aplicaOItem(item: ItemDoPet, aplicaVacina: boolean): boolean {
  return !VACINAS.includes(item) || aplicaVacina
}
