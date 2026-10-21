/**
 * Rampa de aquecimento do número de WhatsApp (`docs/74-AQUECIMENTO-WHATSAPP-PLANO.md`).
 *
 * O teto por tenant (`mensageria.ts`) protege contra UM tenant em laço. Quem a Meta avalia é o
 * NÚMERO, compartilhado por todos: com N tenants mandando o teto de cada um no dia 1, o número
 * estoura a camada inicial sem nenhum tenant tocar no próprio teto. Esta rampa é o freio do número.
 *
 * Só decisão, sem I/O: quem lê variável de ambiente e quem consome o contador é `server/`.
 *
 * Os valores de orçamento são estimativa `[S]`, sem uso real para calibrar — o mesmo estatuto de
 * `TETO_DIARIO_CAMPANHA`. O que importa é a ESTRUTURA (fases que dobram, nunca "liga tudo"); o
 * número exato muda numa linha, sem custo, antes do dia 1 da fase 1.
 *
 * C-017 (`docs/105-ciclo`): portado da branch local `loop/integracao-final` (22/09), onde ficou sem
 * chegar à main. AINDA NÃO ESTÁ LIGADO ao envio: ligar com a fase padrão 0 pararia TODO envio
 * automático. A ligação (`mensageria.ts` + `WHATSAPP_RAMPA_FASE`) é decisão do Eduardo, com a fase
 * configurada antes do deploy.
 */

export type FaseDaRampa = 0 | 1 | 2 | 3 | 4

export type OrcamentoDaFase = {
  /** Mensagens de campanha por dia, somando todos os tenants. `null` = sem orçamento global. */
  campanha: number | null
  /** Lembrete/confirmação/transacional por dia. Separado: campanha não pode consumir a confirmação
   * de agendamento, que é o que o salão mais sente falta quando some. */
  transacional: number | null
}

export const ORCAMENTO_GLOBAL_POR_FASE: Record<FaseDaRampa, OrcamentoDaFase> = {
  // Fase 0: ninguém no automático. O envio manual (link `wa.me` pelo celular do próprio salão)
  // não passa por aqui e continua funcionando.
  0: { campanha: 0, transacional: 0 },
  1: { campanha: 50, transacional: 150 },
  2: { campanha: 150, transacional: 450 },
  3: { campanha: 400, transacional: 1200 },
  // Fase 4: o teto por tenant vira a única defesa.
  4: { campanha: null, transacional: null },
}

/** Nas fases 1 e 2 só entra quem está na lista revisada à mão; da 3 em diante é geral. */
export const FASES_COM_LISTA_DE_TENANTS: readonly FaseDaRampa[] = [1, 2]

export type LeituraDaFase = { fase: FaseDaRampa; valorInvalido: boolean }

/**
 * `undefined`/vazio = fase 0. Valor que não é um inteiro de 0 a 4 TAMBÉM vira fase 0 (falha
 * fechada) e é sinalizado: `"5"`, `"abc"` ou `"2.5"` na variável de ambiente não podem virar
 * "sem limite" por engano de digitação.
 */
export function lerFaseDaRampa(bruto: string | undefined): LeituraDaFase {
  const texto = (bruto ?? '').trim()
  if (texto === '') return { fase: 0, valorInvalido: false }
  if (!/^[0-4]$/.test(texto)) return { fase: 0, valorInvalido: true }
  return { fase: Number(texto) as FaseDaRampa, valorInvalido: false }
}

/** Lista de tenants da fase, separada por vírgula. Espaços e entradas vazias são ignorados. */
export function lerTenantsDaRampa(bruto: string | undefined): Set<string> {
  return new Set(
    (bruto ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== ''),
  )
}

export type CategoriaDaRampa = 'campanha' | 'transacional'

export type DecisaoDaRampa =
  | { permitido: true; orcamentoDiario: number | null }
  | { permitido: false; motivo: 'fase_0' | 'tenant_fora_da_fase' | 'orcamento_zero' }

export function decidirRampa(entrada: {
  fase: FaseDaRampa
  tenantId: string
  tenantsDaRampa: ReadonlySet<string>
  categoria: CategoriaDaRampa
}): DecisaoDaRampa {
  const { fase, tenantId, tenantsDaRampa, categoria } = entrada

  if (fase === 0) return { permitido: false, motivo: 'fase_0' }

  if (FASES_COM_LISTA_DE_TENANTS.includes(fase) && !tenantsDaRampa.has(tenantId)) {
    return { permitido: false, motivo: 'tenant_fora_da_fase' }
  }

  const orcamentoDiario = ORCAMENTO_GLOBAL_POR_FASE[fase][categoria]
  if (orcamentoDiario === 0) return { permitido: false, motivo: 'orcamento_zero' }

  return { permitido: true, orcamentoDiario }
}
