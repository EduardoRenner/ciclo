import { Temporal } from '@js-temporal/polyfill'

/**
 * Lê uma data escrita por gente — numa planilha, num export de outro sistema — e devolve o dia, ou
 * `null` quando não dá para ter certeza.
 *
 * BL-51 (2026-09-28, medido): o importador só aceitava `2026-08-15`, e todo arquivo brasileiro vem
 * `15/08/2026`. A linha entrava, a data da última visita era descartada em silêncio, e o Motor de
 * Ciclo nascia vazio para quem migrou de planilha — exatamente o momento em que o produto deveria
 * mostrar quem já passou da hora de voltar.
 *
 * O produto é pt-BR, então `dd/mm` é sempre dia-mês: não existe a ambiguidade americana `mm/dd` a
 * resolver. Aceita:
 *   - `15/08/2026`, `15-08-2026`, `15.08.2026`, `5/8/2026` (dia e mês com 1 ou 2 dígitos)
 *   - `15/08/26` (ano com 2 dígitos → 2000 + aa)
 *   - `2026-08-15` (ISO), e qualquer um dos acima seguido de hora (`15/08/2026 14:30`), que é como o
 *     Excel exporta uma célula de data e hora
 * Recusa data que não existe (`31/02/2026`) em vez de "corrigir" para outro dia.
 */
export function lerDataInformada(texto: string | null | undefined): Temporal.PlainDate | null {
  if (!texto) return null
  // Só a primeira parte: "15/08/2026 14:30" e "2026-08-15T14:30" viram a data sem a hora.
  const bruto = texto.trim().split(/[\sT]/)[0] ?? ''
  if (bruto === '') return null

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(bruto)
  if (iso) return montar(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(bruto)
  if (br) {
    const ano = br[3]!.length === 2 ? 2000 + Number(br[3]) : Number(br[3])
    return montar(ano, Number(br[2]), Number(br[1]))
  }

  return null
}

function montar(year: number, month: number, day: number): Temporal.PlainDate | null {
  try {
    // `reject`: 31/02 é erro de digitação, não "3 de março". Trocar o dia calado seria pior que
    // não ler — o Motor preveria a volta a partir de uma visita que não aconteceu.
    return Temporal.PlainDate.from({ year, month, day }, { overflow: 'reject' })
  } catch {
    return null
  }
}

/**
 * O instante que representa um DIA informado (planilha, "Quem você já atende") em
 * `clients.last_visit_at`, que é `timestamptz`.
 *
 * Gravar só `'2026-08-15'` fazia o Postgres guardar MEIA-NOITE UTC — que em Brasília é 21h do dia
 * 14. Quem lesse a data no fuso do salão via a visita um dia antes (medido em 29/09 pelo teste da
 * exportação da base). Meio-dia UTC cai no MESMO dia em qualquer fuso de UTC−11 a UTC+11, o que
 * cobre o Brasil inteiro, sem precisar saber o fuso do salão na hora de gravar.
 */
export function instanteDoDiaInformado(dia: Temporal.PlainDate): string {
  return `${dia.toString()}T12:00:00Z`
}
