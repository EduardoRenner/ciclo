/** Mesmo `Intl.NumberFormat` que já se repetia em 9+ arquivos — consolidado só nos que a Fase 2/3 do /admin+site tocou. */
export const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Minutos viram "1h30", não "90 min": é como a profissional fala do horário dela. */
export function duracao(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/**
 * `+5511987654321` → `(11) 98765-4321`, o formato que a profissional reconhece
 * de cabeça. Estava copiado em `clientes/lista.tsx` e `clientes/[id]/ficha.tsx`.
 * Devolve o próprio valor quando não é um celular brasileiro — número
 * estrangeiro importado de planilha aparece cru, e não vazio.
 */
export function formatarTelefone(e164: string | null): string | null {
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164 ?? '')
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

/**
 * Máscara aplicada enquanto a pessoa digita. Só dígitos entram; o `+55` colado
 * de um contato do WhatsApp é descartado (o servidor recoloca ao normalizar
 * para E.164). Trata 8 e 9 dígitos porque telefone fixo de salão ainda existe.
 */
export function mascaraTelefone(entrada: string): string {
  const d = entrada.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
