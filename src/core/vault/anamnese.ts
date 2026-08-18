/** `vertical_packs.anamnesis.questions[]` — literal do formato descrito em `PARTE 9` da especificação. */
export type PerguntaAnamnese = {
  id: string
  label: string
  type: 'bool' | 'text' | 'select'
  options?: string[]
  /** Presente só nas perguntas que acendem alerta; valor é o que, respondido, dispara o alerta. */
  alert_if?: boolean
}

export type FormularioAnamnese = {
  key: string
  version: string
  questions: PerguntaAnamnese[]
}

export type RespostasAnamnese = Record<string, unknown>

export type AvaliacaoAlerta = { hasAlert: boolean; alertLabel: string | null }

const RUBRICA_ALERTA = 'Atenção'

/**
 * TICKET-050. `§9`/`04-SEGURANCA`: "rótulo nunca contém diagnóstico" — a
 * `label` da pergunta é a frase clínica completa ("Já teve reação a cola de
 * cílios?"), então não pode virar `alert_label` por si só. Em vez de manter
 * um dicionário id→rótulo curto que o pack não define, uso um rótulo genérico
 * fixo: sinaliza "abra e confira" sem vazar o motivo antes do AAL2. O
 * `has_alert` booleano é o que já cumpre o "aparece no topo sem abrir".
 */
export function avaliarAlertas(perguntas: PerguntaAnamnese[], respostas: RespostasAnamnese): AvaliacaoAlerta {
  const hasAlert = perguntas.some((p) => p.alert_if !== undefined && respostas[p.id] === p.alert_if)
  return { hasAlert, alertLabel: hasAlert ? RUBRICA_ALERTA : null }
}
