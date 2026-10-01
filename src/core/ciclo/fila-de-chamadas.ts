import type { Classe, Perfil } from '@/core/crm/nota-do-cliente'

/**
 * `docs/95` E2 — a fila de chamadas do dono. Ordena e filtra a lista Recuperar; quem chama é sempre
 * o dono, pelo WhatsApp dele, um de cada vez. Nada aqui envia mensagem.
 *
 * A ordem padrão é a PRIORIDADE: o lucro que volta se a pessoa voltar, pesado pela nota do cliente
 * (`docs/95` E3). Sem nota ainda calculada (cliente novo, rotina que não rodou), a nota conta como
 * meio-termo: nem empurra para o topo nem esconde no fim.
 */

export type ItemDaFila = {
  clientId: string
  serviceId: string
  name: string
  profitCents: number
  valueCents: number
  lateDays: number
  nota?: number | null
  classe?: Classe | null
  perfil?: Perfil | null
}

export const CRITERIOS = ['prioridade', 'lucro', 'nota', 'atraso', 'nome'] as const
export type Criterio = (typeof CRITERIOS)[number]

export const ROTULO_DO_CRITERIO: Record<Criterio, string> = {
  prioridade: 'Prioridade',
  lucro: 'Lucro',
  nota: 'Nota do cliente',
  atraso: 'Mais atrasado',
  nome: 'Nome',
}

/** Nota que vale quando o cliente ainda não tem uma. */
export const NOTA_NEUTRA = 50

export function prioridade(item: Pick<ItemDaFila, 'profitCents' | 'nota'>): number {
  return item.profitCents * ((item.nota ?? NOTA_NEUTRA) / 100)
}

const porNome = (a: ItemDaFila, b: ItemDaFila) => a.name.localeCompare(b.name, 'pt-BR')

/** Ordena sem mexer na lista original. Empate sempre cai no nome, para a ordem não pular. */
export function ordenarFila<T extends ItemDaFila>(itens: readonly T[], criterio: Criterio): T[] {
  const chave: Record<Criterio, (a: T, b: T) => number> = {
    prioridade: (a, b) => prioridade(b) - prioridade(a),
    lucro: (a, b) => b.profitCents - a.profitCents,
    nota: (a, b) => (b.nota ?? -1) - (a.nota ?? -1),
    atraso: (a, b) => b.lateDays - a.lateDays,
    nome: () => 0,
  }
  return [...itens].sort((a, b) => chave[criterio](a, b) || porNome(a, b))
}

export type FiltroDaFila = { perfis?: readonly Perfil[]; classes?: readonly Classe[] }

/** Filtro vazio deixa passar todo mundo; quem ainda não tem nota só passa se não houver filtro. */
export function filtrarFila<T extends ItemDaFila>(itens: readonly T[], filtro: FiltroDaFila): T[] {
  const perfis = filtro.perfis ?? []
  const classes = filtro.classes ?? []
  return itens.filter(
    (i) =>
      (perfis.length === 0 || (i.perfil != null && perfis.includes(i.perfil))) &&
      (classes.length === 0 || (i.classe != null && classes.includes(i.classe))),
  )
}

/** Chave estável de um item da fila (a mesma pessoa pode estar atrasada em dois serviços). */
export function chaveDaFila(item: Pick<ItemDaFila, 'clientId' | 'serviceId'>): string {
  return `${item.clientId}:${item.serviceId}`
}

/** O próximo da fila que ainda não foi tratado hoje; `null` quando acabou. */
export function proximoDaFila<T extends ItemDaFila>(fila: readonly T[], tratados: ReadonlySet<string>): T | null {
  return fila.find((i) => !tratados.has(chaveDaFila(i))) ?? null
}
