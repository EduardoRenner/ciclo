/**
 * Catálogo de itens de manutenção (`docs/106-automotivo`, AUT-202).
 *
 * Um item é uma coisa que se troca ou se verifica no veículo, com os relógios que fazem sentido para
 * ele. A chave é estável (vai para o banco e para o histórico); o nome é o que a tela mostra. As
 * faixas de intervalo NÃO moram aqui: moram nos planos (`perfis.ts` e, depois, os do modelo), porque
 * mudam por motor e por montadora. Aqui fica só o que é verdade para qualquer carro.
 */

export type Relogio = 'uso' | 'tempo' | 'desgaste'
export type TipoDeVeiculo = 'carro' | 'moto'
export type Cambio = 'manual' | 'automatico'

export type Item = {
  nome: string
  veiculo: TipoDeVeiculo
  relogios: readonly Relogio[]
  /** Item crítico: se vencer, quebra ou põe em risco (correia, freio). Nunca é empurrado para depois do vencimento. */
  critico: boolean
  /** Só existe em veículo com este câmbio (fluido de câmbio automático; kit de embreagem). */
  soCambio?: Cambio
  /** O mínimo do desgaste medido (pastilha em %, sulco do pneu em mm). */
  minimo?: { valor: number; unidade: '%' | 'mm' }
}

export const ITENS = {
  oleo_motor: { nome: 'Óleo do motor e filtro de óleo', veiculo: 'carro', relogios: ['uso', 'tempo'], critico: false },
  filtro_combustivel: { nome: 'Filtro de combustível', veiculo: 'carro', relogios: ['uso'], critico: false },
  filtro_ar: { nome: 'Filtro de ar do motor', veiculo: 'carro', relogios: ['uso', 'tempo'], critico: false },
  filtro_cabine: { nome: 'Filtro de cabine (ar-condicionado)', veiculo: 'carro', relogios: ['tempo'], critico: false },
  velas: { nome: 'Velas de ignição', veiculo: 'carro', relogios: ['uso'], critico: false },
  correia_dentada: { nome: 'Correia dentada e tensor', veiculo: 'carro', relogios: ['uso', 'tempo'], critico: true },
  correia_acessorios: { nome: 'Correia de acessórios', veiculo: 'carro', relogios: ['uso', 'tempo'], critico: false },
  pastilhas_freio: { nome: 'Pastilhas de freio', veiculo: 'carro', relogios: ['uso', 'desgaste'], critico: true, minimo: { valor: 15, unidade: '%' } },
  discos_freio: { nome: 'Discos de freio', veiculo: 'carro', relogios: ['uso', 'desgaste'], critico: true },
  fluido_freio: { nome: 'Fluido de freio', veiculo: 'carro', relogios: ['tempo', 'uso'], critico: true },
  arrefecimento: { nome: 'Líquido de arrefecimento', veiculo: 'carro', relogios: ['tempo'], critico: false },
  fluido_cambio: { nome: 'Fluido do câmbio automático', veiculo: 'carro', relogios: ['uso'], critico: false, soCambio: 'automatico' },
  alinhamento: { nome: 'Alinhamento e balanceamento', veiculo: 'carro', relogios: ['uso', 'tempo'], critico: false },
  rodizio_pneus: { nome: 'Rodízio de pneus', veiculo: 'carro', relogios: ['uso'], critico: false },
  pneus: { nome: 'Pneus', veiculo: 'carro', relogios: ['desgaste', 'tempo'], critico: true, minimo: { valor: 1.6, unidade: 'mm' } },
  bateria: { nome: 'Bateria', veiculo: 'carro', relogios: ['tempo'], critico: false },
  amortecedores: { nome: 'Amortecedores', veiculo: 'carro', relogios: ['uso'], critico: false },
  embreagem: { nome: 'Kit de embreagem', veiculo: 'carro', relogios: ['uso'], critico: false, soCambio: 'manual' },
  palhetas: { nome: 'Palhetas do limpador', veiculo: 'carro', relogios: ['tempo'], critico: false },
  higienizacao_ar: { nome: 'Higienização do ar-condicionado', veiculo: 'carro', relogios: ['tempo'], critico: false },
  revisao_geral: { nome: 'Revisão geral (inspeção)', veiculo: 'carro', relogios: ['uso', 'tempo'], critico: false },
  moto_oleo: { nome: 'Óleo do motor', veiculo: 'moto', relogios: ['uso', 'tempo'], critico: false },
  moto_relacao: { nome: 'Relação (corrente, coroa e pinhão)', veiculo: 'moto', relogios: ['uso', 'desgaste'], critico: true },
  moto_freio: { nome: 'Pastilhas ou lonas de freio', veiculo: 'moto', relogios: ['uso', 'desgaste'], critico: true, minimo: { valor: 15, unidade: '%' } },
  moto_pneus: { nome: 'Pneus', veiculo: 'moto', relogios: ['desgaste', 'tempo'], critico: true, minimo: { valor: 1.6, unidade: 'mm' } },
  moto_vela: { nome: 'Vela de ignição', veiculo: 'moto', relogios: ['uso'], critico: false },
  moto_filtro_ar: { nome: 'Filtro de ar', veiculo: 'moto', relogios: ['uso'], critico: false },
  moto_cabos: { nome: 'Cabos (embreagem e acelerador)', veiculo: 'moto', relogios: ['uso'], critico: false },
  moto_revisao: { nome: 'Revisão geral', veiculo: 'moto', relogios: ['uso', 'tempo'], critico: false },
} as const satisfies Record<string, Item>

export type ChaveDoItem = keyof typeof ITENS
