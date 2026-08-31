/**
 * Quanto a cliente adianta para segurar o horário.
 *
 * As colunas `deposit_bps` e `deposit_min_cents` existem em `services` desde a migration 0001 e
 * têm escritor (`servicos.ts`) e um leitor no painel (o selo "Sinal X%" da lista). O que nunca
 * existiu é o cálculo em si nem a exibição para quem agenda — ou seja, o dono podia configurar um
 * sinal que a cliente jamais veria.
 *
 * Mostrar o valor **não é cobrar**: não há meio de pagamento no CICLO, e este arquivo não
 * pretende que haja. O que ele resolve é a expectativa — a cliente lê "este horário pede R$ 21 de
 * sinal" antes de confirmar, e o combinado acontece no WhatsApp como já acontece hoje. É a parte
 * do efeito que não depende de PSP, CNPJ nem de uma linha de integração financeira.
 *
 * Em `core/` porque é dinheiro e regra de negócio (regras 3 e 5 do CLAUDE.md): centavos inteiros,
 * basis points para percentual, sem I/O.
 */

export type EntradaDeSinal = {
  /** Preço do serviço em centavos. */
  precoCents: number
  /** Percentual em basis points — 3000 = 30%. */
  depositBps: number
  /** Piso em centavos: um percentual pequeno sobre serviço barato não vale a fricção de cobrar. */
  depositMinCents: number
}

/**
 * `null` quando não há sinal a pedir — a tela não desenha nada, em vez de anunciar "R$ 0,00", que
 * é pior que silêncio: sugere que existe uma cobrança de zero real.
 *
 * O piso só se aplica quando JÁ existe um percentual configurado. Um `deposit_min_cents` sozinho,
 * com `deposit_bps` zerado, significa "não cobro sinal, mas se cobrasse seria pelo menos isso" —
 * tratar como sinal ativo faria todo serviço da casa passar a pedir adiantamento por causa de um
 * campo que ninguém entendeu que estava ligado.
 */
export function sinalEmCentavos(e: EntradaDeSinal): number | null {
  if (e.depositBps <= 0) return null
  if (e.precoCents <= 0) return null

  // Arredonda para cima: o piso é um mínimo, e um centavo a menos que o mínimo não é o mínimo.
  const porPercentual = Math.ceil((e.precoCents * e.depositBps) / 10_000)
  const valor = Math.max(porPercentual, e.depositMinCents)

  // Sinal nunca passa do preço — um `deposit_bps` acima de 10000 é barrado no schema, mas o piso
  // não é, e um piso alto sobre serviço barato faria a cliente adiantar mais do que o serviço custa.
  return Math.min(valor, e.precoCents)
}
