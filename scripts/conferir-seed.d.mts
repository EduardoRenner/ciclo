// Tipos do `conferir-seed.mjs` para o teste em TypeScript — o script roda em `node` puro.
export type MedidaDoNegocio = {
  slug: string
  feitos: number
  faltas: number
  porDia: number[]
  porHora: number[]
  diasComEntrada: number
  comandasSemForma: number
  ciclos: number
  recuperar: number
  loginProfissional: boolean
  loginRecepcao: boolean
}

export const FAIXAS: {
  comparecimentoMin: number
  comparecimentoMax: number
  maxDiaPct: number
  maxHoraPct: number
  diasComEntradaMin: number
  recuperarMin: number
}

export const NEGOCIOS_DE_DEMONSTRACAO: string[]

export function avaliarSeed(negocios: MedidaDoNegocio[]): string[]
