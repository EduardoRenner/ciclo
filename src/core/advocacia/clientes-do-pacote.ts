import type { EstadoDoCaso } from './casos'
import type { ProximoPasso } from './resumo-do-caso'

/**
 * A lista de Clientes do pacote Advocacia (docs/101 T2.4, anexo 04 §4.2): cada cliente com a fase,
 * quem responde por ele, o próximo passo e os selos. Pura: a lista de casos chega pronta (com o próximo
 * passo de cada um já calculado por `resumo-do-caso.ts`) e aqui só se agrupa por cliente.
 */

export type Fase = 'em_prospeccao' | 'ativo' | 'encerrado'

export const ROTULO_DA_FASE: Readonly<Record<Fase, string>> = { em_prospeccao: 'Em prospecção', ativo: 'Ativo', encerrado: 'Encerrado' }

export type CasoDoCliente = {
  clienteId: string
  estado: EstadoDoCaso
  sigiloso: boolean
  responsavel: string | null
  proximo: ProximoPasso | null
}

export type ClienteNaLista = {
  id: string
  nome: string
  telefone: string | null
  fase: Fase
  responsavel: string | null
  proximo: ProximoPasso | null
  casosAtivos: number
  sigiloso: boolean
  holding: boolean
}

const encerrado = (e: EstadoDoCaso) => e === 'concluido' || e === 'arquivado'

/** O que aperta primeiro: atrasado, depois a data; sem próximo passo, por último. */
function maisUrgente(a: ProximoPasso | null, b: ProximoPasso | null): number {
  if (a && !b) return -1
  if (!a && b) return 1
  if (!a || !b) return 0
  if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1
  return (a.ate ?? '9999').localeCompare(b.ate ?? '9999')
}

export function montarClientes(
  clientes: readonly { id: string; nome: string; telefone: string | null }[],
  casos: readonly CasoDoCliente[],
  comHolding: ReadonlySet<string>,
): ClienteNaLista[] {
  const porCliente = new Map<string, CasoDoCliente[]>()
  for (const c of casos) porCliente.set(c.clienteId, [...(porCliente.get(c.clienteId) ?? []), c])

  return clientes
    .map((cl): ClienteNaLista => {
      const dele = porCliente.get(cl.id) ?? []
      const ativos = dele.filter((c) => !encerrado(c.estado))
      const urgente = [...ativos].sort((a, b) => maisUrgente(a.proximo, b.proximo))[0]
      return {
        id: cl.id,
        nome: cl.nome,
        telefone: cl.telefone,
        fase: dele.length === 0 ? 'em_prospeccao' : ativos.length > 0 ? 'ativo' : 'encerrado',
        responsavel: urgente?.responsavel ?? null,
        proximo: urgente?.proximo ?? null,
        casosAtivos: ativos.length,
        sigiloso: dele.some((c) => c.sigiloso),
        holding: comHolding.has(cl.id),
      }
    })
    .sort((a, b) => maisUrgente(a.proximo, b.proximo) || a.nome.localeCompare(b.nome, 'pt-BR'))
}
