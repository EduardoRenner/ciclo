// Tipos do `placar-distribuicao.mjs` para o teste em TypeScript — o script roda em `node` puro.
export type LinhaDoFunil = {
  canal: string
  contas: number
  base_importada: number
  motor_viu_valor: number
  recuperacao_enviada: number
  cliente_voltou: number
  pagantes: number
}

export type Indicacao = { canal: string; quem_trouxe: string; conta_nova: string; plano: string }

export const CONTA_QUE_NAO_E_NEGOCIO: RegExp[]

export function montarPlacar(
  tenants: { id: string; slug: string; plan: string; deleted_at: string | null }[],
  eventos: { tenant_id: string; event_type: string; meta: unknown }[],
): { funil: LinhaDoFunil[]; indicacoes: Indicacao[]; contasReais: number; contasSemEvento: number }
