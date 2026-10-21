import type { ChaveDoItem } from './itens'

/**
 * Planos GENÉRICOS por perfil de veículo (`docs/106-automotivo`, AUT-203) — a camada de baixo da
 * herança. Valem quando não temos o plano da família de motor nem do manual do modelo, e a tela tem
 * de dizer isso ("plano genérico"). Os números são o meio CONSERVADOR das faixas de imprensa
 * especializada (`docs/106-automotivo/01-pesquisa.md` §2); o manual do modelo prevalece sempre.
 */

export type Intervalo = {
  /** Vence a cada N km (relógio de uso). */
  km?: number
  /** Vence a cada N meses (relógio de tempo; limite fixo desde a última troca). */
  meses?: number
  /** Em uso severo o intervalo de uso/tempo é multiplicado por este fator (manual: "metade" = 0,5). */
  fatorSevero?: number
}

export type Plano = Partial<Record<ChaveDoItem, Intervalo>>

export type Perfil =
  | 'carro_flex_aspirado'
  | 'carro_turbo'
  | 'carro_diesel'
  | 'carro_hibrido'
  | 'carro_eletrico'
  | 'moto_baixa'
  | 'moto_media'

export const FONTE_DOS_PERFIS = 'docs/106-automotivo/01-pesquisa.md §2 (faixas de imprensa especializada, 14/10/2026)'

const CARRO_BASE: Plano = {
  oleo_motor: { km: 10_000, meses: 12, fatorSevero: 0.5 },
  filtro_combustivel: { km: 10_000 },
  filtro_ar: { km: 20_000, meses: 24, fatorSevero: 0.5 },
  filtro_cabine: { meses: 12 },
  velas: { km: 40_000 },
  correia_dentada: { km: 60_000, meses: 36 },
  correia_acessorios: { km: 50_000, meses: 36 },
  pastilhas_freio: { km: 30_000 },
  discos_freio: { km: 60_000 },
  fluido_freio: { meses: 24 },
  arrefecimento: { meses: 24 },
  fluido_cambio: { km: 60_000, fatorSevero: 0.67 },
  alinhamento: { km: 10_000, meses: 12 },
  rodizio_pneus: { km: 10_000 },
  pneus: { meses: 60 },
  bateria: { meses: 36 },
  amortecedores: { km: 60_000 },
  embreagem: { km: 80_000 },
  palhetas: { meses: 12 },
  higienizacao_ar: { meses: 12 },
  revisao_geral: { km: 10_000, meses: 12 },
}

/** O plano sem os itens que este perfil não tem (diesel sem velas; elétrico sem motor a combustão). */
function sem(plano: Plano, ...itens: ChaveDoItem[]): Plano {
  return Object.fromEntries(Object.entries(plano).filter(([k]) => !itens.includes(k as ChaveDoItem))) as Plano
}

export const PERFIS: Record<Perfil, Plano> = {
  carro_flex_aspirado: CARRO_BASE,
  // Turbo: óleo mais exigido; velas mais solicitadas.
  carro_turbo: { ...CARRO_BASE, oleo_motor: { km: 10_000, meses: 12, fatorSevero: 0.5 }, velas: { km: 30_000 } },
  // Diesel: sem velas de ignição; filtro de combustível mais frequente.
  carro_diesel: { ...sem(CARRO_BASE, 'velas'), filtro_combustivel: { km: 20_000, meses: 12 } },
  // Híbrido: freio regenerativo poupa pastilha.
  carro_hibrido: { ...CARRO_BASE, pastilhas_freio: { km: 60_000 } },
  // Elétrico: sem óleo do motor, velas, correia dentada, filtro de combustível, embreagem.
  carro_eletrico: {
    ...sem(CARRO_BASE, 'oleo_motor', 'velas', 'correia_dentada', 'filtro_combustivel', 'embreagem', 'filtro_ar', 'correia_acessorios'),
    pastilhas_freio: { km: 80_000 },
  },
  moto_baixa: {
    moto_oleo: { km: 3_000, meses: 6, fatorSevero: 0.5 },
    moto_relacao: { km: 20_000 },
    moto_freio: { km: 15_000 },
    moto_pneus: { meses: 60 },
    moto_vela: { km: 10_000 },
    moto_filtro_ar: { km: 10_000, fatorSevero: 0.5 },
    moto_cabos: { km: 15_000 },
    moto_revisao: { km: 6_000, meses: 12 },
  },
  moto_media: {
    moto_oleo: { km: 5_000, meses: 6, fatorSevero: 0.5 },
    moto_relacao: { km: 25_000 },
    moto_freio: { km: 20_000 },
    moto_pneus: { meses: 60 },
    moto_vela: { km: 12_000 },
    moto_filtro_ar: { km: 12_000, fatorSevero: 0.5 },
    moto_cabos: { km: 20_000 },
    moto_revisao: { km: 10_000, meses: 12 },
  },
}
