import { REGRA_PUBLICACAO, REGRA_SUSPENSAO_FIM_DE_ANO, REGRAS_DO_RITO, type Regra } from './prazo-calculo'

/**
 * As regras de contagem que a DIREÇÃO confirma (docs/101 T4.6). Enquanto uma regra não estiver
 * confirmada (ou validada na origem), a sugestão de prazo não vem preenchida: a triagem pede a data.
 * A lista sai das regras do núcleo, então regra nova no cálculo aparece aqui sem ninguém lembrar.
 */
export type RegraNaTela = Regra & { jaValidada: boolean }

export const REGRAS_CONFIRMAVEIS: readonly RegraNaTela[] = [
  { ...REGRA_PUBLICACAO, jaValidada: REGRA_PUBLICACAO.validada },
  ...Object.values(REGRAS_DO_RITO).map((r) => ({ id: r.id, rotulo: r.rotulo, fonte: r.fonte, validada: r.validada, jaValidada: r.validada })),
  { ...REGRA_SUSPENSAO_FIM_DE_ANO, jaValidada: REGRA_SUSPENSAO_FIM_DE_ANO.validada },
]

export const IDS_CONFIRMAVEIS: readonly string[] = REGRAS_CONFIRMAVEIS.filter((r) => !r.jaValidada).map((r) => r.id)

/** Lê `tenants.settings.advocacia.regras_confirmadas` sem confiar no formato (JSON de quem já gravou). */
export function regrasConfirmadas(settings: unknown): string[] {
  const lista = (settings as { advocacia?: { regras_confirmadas?: unknown } } | null)?.advocacia?.regras_confirmadas
  return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string' && IDS_CONFIRMAVEIS.includes(x)) : []
}

/** Grava a lista dentro de `settings` sem apagar nenhuma outra chave (o `settings` serve várias telas). */
export function comRegrasConfirmadas(settings: unknown, ids: readonly string[]): Record<string, unknown> {
  const base = settings && typeof settings === 'object' && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {}
  const advocacia = base.advocacia && typeof base.advocacia === 'object' && !Array.isArray(base.advocacia) ? (base.advocacia as Record<string, unknown>) : {}
  const validos = [...new Set(ids.filter((id) => IDS_CONFIRMAVEIS.includes(id)))].sort()
  return { ...base, advocacia: { ...advocacia, regras_confirmadas: validos } }
}
