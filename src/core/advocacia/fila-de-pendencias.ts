import { transicionar, type EstadoDaPendencia } from './checklist'
import { montarMensagem } from './mensagens'

/**
 * A fila do botão central do pacote Advocacia (docs/101 T2.7): "o que falta de cada cliente, e há
 * quantos dias". Pura. A tela só desenha o que sai daqui, e o servidor só lê as linhas.
 *
 * Agrupa por CLIENTE, não por caso: quem cobra liga para uma pessoa, e uma mensagem só com tudo o que
 * falta é melhor que três mensagens no mesmo dia. Dentro do cliente, o caso aparece em cada item.
 */

export type ItemDaFila = {
  id: string
  rowVersion: number
  titulo: string
  estado: EstadoDaPendencia
  quemDeve: 'cliente' | 'equipe'
  venceEm: string | null
  rodadaDesde: string
  rodada: number
  motivoDaDevolucao: string | null
  casoId: string
  casoParaCliente: string
  casoTitulo: string
  clienteId: string
  clienteNome: string
  clienteTelefone: string | null
}

export type GrupoDaFila = {
  clienteId: string
  clienteNome: string
  /** Do item mais antigo do cliente: é por ele que a fila ordena. */
  diasEmAberto: number
  atrasados: number
  itens: (ItemDaFila & { diasEmAberto: number; atrasado: boolean })[]
  /** `null` quando não há o que cobrar do cliente (só itens da equipe ou só recebidos). */
  cobranca: { texto: string; link: string } | { erro: string } | null
}

/** Estados que aparecem na fila. Concluído e cancelado saem; rascunho aparece para a direção aprovar. */
export const ESTADOS_NA_FILA: readonly EstadoDaPendencia[] = ['rascunho', 'pendente', 'devolvido', 'recebido', 'em_conferencia']

/** Estados em que a pendência ainda espera alguém fazer a parte dela (cliente, ou a equipe num item dela). */
const ESPERANDO: readonly EstadoDaPendencia[] = ['rascunho', 'pendente', 'devolvido']

/** Estados em que a bola está com o cliente: só esses entram na mensagem de cobrança. */
const COBRAVEIS: readonly EstadoDaPendencia[] = ['pendente', 'devolvido']

const E164 = /^\+[1-9]\d{7,14}$/

function diasEntre(deIso: string, ateIso: string): number {
  const ms = Date.parse(`${ateIso}T00:00:00Z`) - Date.parse(`${deIso}T00:00:00Z`)
  return Math.max(0, Math.round(ms / 86_400_000))
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/u)[0] ?? null

export function linkDoWhatsApp(telefone: string | null, texto: string): string {
  // Sem telefone válido, o WhatsApp abre o seletor de contato: a pessoa escolhe para quem vai.
  const destino = telefone && E164.test(telefone) ? telefone.slice(1) : ''
  return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`
}

export function montarFila(itens: readonly ItemDaFila[], hoje: string, escritorio: string): GrupoDaFila[] {
  const porCliente = new Map<string, ItemDaFila[]>()
  for (const i of itens) {
    if (!ESTADOS_NA_FILA.includes(i.estado)) continue
    porCliente.set(i.clienteId, [...(porCliente.get(i.clienteId) ?? []), i])
  }

  const grupos: GrupoDaFila[] = []
  for (const [clienteId, doCliente] of porCliente) {
    const comDias = doCliente
      .map((i) => ({
        ...i,
        diasEmAberto: diasEntre(i.rodadaDesde, hoje),
        // Atraso é de quem está com a bola: recebido ou em conferência já não espera ninguém de fora.
        atrasado: i.venceEm !== null && i.venceEm < hoje && ESPERANDO.includes(i.estado),
      }))
      .sort((a, b) => Number(b.atrasado) - Number(a.atrasado) || b.diasEmAberto - a.diasEmAberto || a.titulo.localeCompare(b.titulo, 'pt-BR'))
    const primeiro = comDias[0]!

    const cobraveis = comDias.filter((i) => i.quemDeve === 'cliente' && COBRAVEIS.includes(i.estado))
    let cobranca: GrupoDaFila['cobranca'] = null
    if (cobraveis.length > 0) {
      // Mais de um caso: a frase fala do conjunto, sem nomear assunto (o nome do caso pode ser sigiloso).
      const casos = new Set(cobraveis.map((i) => i.casoId))
      const casoParaCliente = casos.size === 1 ? cobraveis[0]!.casoParaCliente : 'os seus atendimentos'
      const m = montarMensagem({
        tipo: 'cobranca',
        primeiroNome: primeiroNome(primeiro.clienteNome),
        escritorio,
        casoParaCliente,
        itens: cobraveis.map((i) => i.titulo),
      })
      cobranca = m.ok ? { texto: m.texto, link: linkDoWhatsApp(primeiro.clienteTelefone, m.texto) } : { erro: m.motivo }
    }

    grupos.push({
      clienteId,
      clienteNome: primeiro.clienteNome,
      diasEmAberto: Math.max(...comDias.map((i) => i.diasEmAberto)),
      atrasados: comDias.filter((i) => i.atrasado).length,
      itens: comDias,
      cobranca,
    })
  }

  return grupos.sort(
    (a, b) => b.atrasados - a.atrasados || b.diasEmAberto - a.diasEmAberto || a.clienteNome.localeCompare(b.clienteNome, 'pt-BR'),
  )
}

type AcaoDaTela = 'aprovar' | 'receber' | 'concluir' | 'devolver'

/**
 * As ações que a tela oferece. A preferência muda com quem deve (do cliente se RECEBE; da equipe se
 * CONCLUI), mas a palavra final é de `transicionar`, a mesma função que o servidor aplica: um botão
 * que o servidor recusaria nunca aparece.
 */
export function acoesDaTela(estado: EstadoDaPendencia, quemDeve: 'cliente' | 'equipe'): AcaoDaTela[] {
  const preferidas: AcaoDaTela[] = quemDeve === 'cliente' ? ['aprovar', 'receber', 'concluir', 'devolver'] : ['aprovar', 'concluir', 'devolver']
  const validas = preferidas.filter((a) => transicionar({ estado, rodada: 1 }, a, 'motivo de teste').ok)
  // Pendente do cliente: "Recebi" basta; concluir sem receber é atalho que a fila não oferece.
  return estado === 'pendente' && quemDeve === 'cliente' ? validas.filter((a) => a !== 'concluir') : validas
}
