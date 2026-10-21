// Tipos do `contas-de-salao.mjs` para a guarda em TypeScript — o script roda em `node` puro.
export type Servico = { nome: string; oficio: string; preco: number; min: number; ritmo: number | null; peso: number }
export type Profissional = {
  nome: string
  dona?: boolean
  papel?: string
  cor: string
  carteira: { oficio: string; clientes: number }[]
  tambem?: string[]
  noMesmoDia?: { de: string; servico: string; fracao: number }
}
export type Conta = {
  slug: string
  nome: string
  vertical: string
  plano: 'gratis' | 'essencial' | 'equipe' | 'avancado'
  agendaSoDoProfissional?: boolean
  revenda: string
  servicos: Servico[]
  equipe: Profissional[]
}
export type ClienteDoPlano = {
  nome: string
  profIdx: number
  servico: Servico & { ritmo: number }
  extra: Servico | null
  atraso: number | null
  ultimaHa: number
}

export const CONTAS: Conta[]
export const HOMENS: string[]
export const MINUTOS_ABERTOS_POR_SEMANA: number
export const FAIXA_DE_OCUPACAO: { min: number; max: number }
export const FAIXA_DE_ATRASADAS: { min: number; max: number }
export function rnd(...partes: unknown[]): number
export function oficiosDe(profissional: Profissional): string[]
export function servicosDe(conta: Conta, profissional: Profissional): Servico[]
export function nomesDaConta(slug: string, quantos: number): string[]
export function planoDeClientes(conta: Conta): ClienteDoPlano[]
export function ocupacaoPorProfissional(conta: Conta, clientes?: ClienteDoPlano[]): { nome: string; pct: number }[]
export function pctAtrasadas(clientes: ClienteDoPlano[]): number
