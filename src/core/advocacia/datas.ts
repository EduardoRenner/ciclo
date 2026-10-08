// Origem: LUBI src/lib/domain/dates.ts @ db8aeac, só as funções de dia civil que o domínio jurídico usa.
/**
 * Datas de prazo são DIAS (AAAA-MM-DD), não instantes: o prazo vence num dia do tribunal, e somar
 * horas em horário local é a armadilha que o `CLAUDE.md` proíbe. Toda aritmética aqui é em UTC sobre
 * a data civil, sem efeito de horário de verão.
 *
 * O que NÃO veio do LUBI: o `hojeBrt()` com `new Date()` como padrão. No CICLO o "hoje" é o dia no
 * fuso DO TENANT (`hojeNoFuso`), e o instante entra sempre por argumento: `core/` não lê relógio.
 */

/** O dia civil (AAAA-MM-DD) de um instante num fuso IANA. O instante é obrigatório: nada de relógio escondido. */
export function hojeNoFuso(timezone: string, agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}

/** Soma dias a uma data AAAA-MM-DD. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10)
}

/** Diferença em dias inteiros (b − a). */
export function diffDays(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number) as [number, number, number]
  const [yb, mb, db] = b.split('-').map(Number) as [number, number, number]
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
}

/** 14/10 */
export function fmtDiaMes(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** "qui 02/10": o dia da semana junto da data, como a memória de cálculo mostra. */
export function fmtDiaSemana(iso: string): string {
  return `${DIAS_DA_SEMANA[diaDaSemana(iso)]} ${fmtDiaMes(iso)}`
}
