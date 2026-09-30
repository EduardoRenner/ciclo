import { Temporal } from '@js-temporal/polyfill'

/**
 * docs/84 §2.2 — "demanda não atendida": alguém abriu a página pública, escolheu um serviço e um
 * dia, e não havia horário. Até aqui isso não era gravado em lugar nenhum, e é o único dado que
 * responde "e se eu abrir sábado?" (MI-6) e o vazamento "horário vazio" com demanda comprovada
 * (docs/84 §7.1) sem chute.
 *
 * Esta função só CLASSIFICA; quem grava é `disponibilidadePublica`. O motivo importa porque cada
 * um pede uma ação diferente do dono:
 * - `dia_fechado`: ninguém tem expediente nesse dia da semana → "e se eu abrir?";
 * - `sem_vaga`: há expediente e ele está cheio → agenda lotada, candidato a encaixe/contratação;
 * - `sem_profissional`: ninguém aceita agendamento online → configuração, não demanda de horário.
 *
 * `null` quando NÃO é demanda: havia horário, ou o dia está fora da janela em que o salão aceita
 * agendar (passado, ou além do "até quantos dias antes"). Pedir o dia 32 de antecedência numa
 * agenda que abre 30 não é gente querendo e não achando — é a regra da casa.
 */
export type MotivoDemanda = 'dia_fechado' | 'sem_vaga' | 'sem_profissional'

export function classificarDemanda(o: {
  haviaHorario: boolean
  profissionaisOnline: number
  algumExpediente: boolean
  dia: Temporal.PlainDate
  hoje: Temporal.PlainDate
  maxAdvanceDays: number
}): MotivoDemanda | null {
  if (o.haviaHorario) return null
  if (Temporal.PlainDate.compare(o.dia, o.hoje) < 0) return null
  if (Temporal.PlainDate.compare(o.dia, o.hoje.add({ days: o.maxAdvanceDays })) > 0) return null
  if (o.profissionaisOnline === 0) return 'sem_profissional'
  return o.algumExpediente ? 'sem_vaga' : 'dia_fechado'
}
