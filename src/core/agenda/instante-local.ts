/**
 * APR-201 (docs/98 C-08, C-22): data e hora LOCAIS do negócio ↔ instante UTC, sem depender do fuso
 * do aparelho. O editor de expediente fazia `new Date('2026-10-20T14:00')`, que é o fuso de quem
 * digita: uma dona em Manaus marcando folga das 14:00 num salão de São Paulo gravava 15:00 de SP.
 *
 * Só `Intl` (como o resto de `core/agenda/dias.ts`): nada de biblioteca no cliente.
 */

type Partes = { y: number; m: number; d: number; hh: number; mm: number }

function partesNoFuso(instante: Date, timezone: string): Partes {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const p = Object.fromEntries(f.formatToParts(instante).map((x) => [x.type, x.value]))
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: Number(p.hour) % 24, mm: Number(p.minute) }
}

/** `'2026-10-20T14:00'` no fuso do negócio → instante ISO (UTC). Hora que não existe (virada de horário de verão) cai na seguinte. */
export function paraInstante(local: string, timezone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local)
  if (!m) throw new Error(`data local inválida: ${local}`)
  const [y, mo, d, hh, mi] = m.slice(1).map(Number) as [number, number, number, number, number]
  const alvo = Date.UTC(y, mo - 1, d, hh, mi)
  let palpite = alvo
  // Duas voltas bastam: a primeira acerta o deslocamento, a segunda corrige a borda de horário de verão.
  for (let i = 0; i < 2; i++) {
    const p = partesNoFuso(new Date(palpite), timezone)
    palpite += alvo - Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm)
  }
  return new Date(palpite).toISOString()
}

/** Instante ISO → `'YYYY-MM-DDTHH:mm'` no fuso do negócio, o formato do `<input type="datetime-local">`. */
export function paraLocal(iso: string, timezone: string): string {
  const p = partesNoFuso(new Date(iso), timezone)
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${p.y}-${dois(p.m)}-${dois(p.d)}T${dois(p.hh)}:${dois(p.mm)}`
}
