import { quandoLocal } from '@/core/text/quando-local'

/**
 * O aviso que a equipe recebe quando a cliente cancela pelo link (docs/112 EXP-A03).
 *
 * Antes, cancelar pelo link liberava a vaga e ninguém ficava sabendo: a profissional descobria
 * na hora, com a cadeira vazia. O texto diz o que mudou e o que dá para fazer com isso.
 */
export function avisoDeCancelamentoPelaCliente(entrada: {
  nomeDaCliente: string | null
  startsAt: string
  timezone: string
}): { title: string; body: string } {
  // Sem o nome, "Quem tinha marcado": a guarda `copy-nao-supoe-genero` reprovou "A cliente".
  const quem = entrada.nomeDaCliente?.trim() || 'Quem tinha marcado'
  return {
    title: 'Horário cancelado',
    body: `${quem} cancelou o horário de ${quandoLocal(entrada.startsAt, entrada.timezone)}. A vaga ficou livre para outra pessoa.`,
  }
}
