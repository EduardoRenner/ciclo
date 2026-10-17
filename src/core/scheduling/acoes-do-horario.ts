/**
 * APR-105 (docs/98 I-08): o detalhe do horário tem UM primário, a próxima ação do estado. Antes, no
 * "confirmado", "Chegou" e "Marcar falta" saíam os dois como primários, com "Cancelar" vermelho cheio
 * colado neles: três decisões com o mesmo peso no balcão, uma delas destrutiva.
 *
 * - O primário segue o caminho feliz: pendente → Confirmar, confirmado → Chegou, chegou → Concluir.
 * - "Marcar falta" é secundária: o sistema sugere, quem marca é o profissional (CLAUDE.md).
 * - Cancelar sai daqui: a tela o põe no fim, separado, com a consequência escrita.
 */
import { proximosEstados, type EstadoAgendamento } from '@/core/scheduling/state'

const PRINCIPAL: Partial<Record<EstadoAgendamento, EstadoAgendamento>> = {
  pending: 'confirmed',
  confirmed: 'arrived',
  arrived: 'done',
}

/** Transições que viram botão de ação (cancelar e expirar têm caminho próprio ou são do sistema). */
const COM_BOTAO = new Set<EstadoAgendamento>(['confirmed', 'arrived', 'done', 'no_show'])

export type AcoesDoHorario = {
  principal: EstadoAgendamento | null
  secundarias: EstadoAgendamento[]
  podeCancelar: boolean
}

export function acoesDoHorario(estado: EstadoAgendamento): AcoesDoHorario {
  const proximos = proximosEstados(estado)
  const candidato = PRINCIPAL[estado]
  const principal = candidato && proximos.includes(candidato) ? candidato : null
  return {
    principal,
    secundarias: proximos.filter((e) => COM_BOTAO.has(e) && e !== principal),
    podeCancelar: proximos.includes('canceled'),
  }
}
