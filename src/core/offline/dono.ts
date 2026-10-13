/**
 * APR-020 (achados C-46, G-04): de quem é cada item da fila offline.
 *
 * A fila não guardava quem criou a mutação. Se a sessão vencia e OUTRA pessoa entrava no mesmo
 * aparelho, a fila da anterior saía com o login da nova — autor errado na trilha de auditoria, e
 * agendamento criado "pela recepção" que a recepção nunca fez. Fica pior com a drenagem ao abrir o
 * app (APR-021), que roda logo depois do login: por isso este filtro vem ANTES de qualquer reenvio,
 * inclusive o de `401/403` (R-31).
 *
 * Item sem dono (gravado antes deste conserto) é "dono desconhecido": não sai sem a pessoa
 * confirmar. Também não some — apagar trabalho em silêncio é o defeito que a fila existe para evitar.
 */
export type DonoDaMutacao = { userId: string; tenantId: string }

export type ContextoDaSessao = { userId: string; tenantId: string }

export type FilaSeparada<T> = {
  /** Do usuário e do negócio desta sessão: pode drenar. */
  minhas: T[]
  /** De outra pessoa ou de outro negócio neste aparelho: fica guardado, a faixa avisa. */
  deOutros: T[]
  /** Sem dono gravado (formato anterior): fica guardado até a pessoa decidir. */
  semDono: T[]
}

export function separarFilaPorDono<T extends { dono?: DonoDaMutacao | null }>(fila: readonly T[], sessao: ContextoDaSessao): FilaSeparada<T> {
  const separada: FilaSeparada<T> = { minhas: [], deOutros: [], semDono: [] }
  for (const item of fila) {
    if (!item.dono) separada.semDono.push(item)
    else if (item.dono.userId === sessao.userId && item.dono.tenantId === sessao.tenantId) separada.minhas.push(item)
    else separada.deOutros.push(item)
  }
  return separada
}
