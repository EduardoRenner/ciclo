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
 * Estava copiado em `clientes/lista.tsx` e `clientes/[id]/ficha.tsx`, e depois morou aqui. Desde
 * 29/09 mora em `core/text/telefone.ts`, porque o Motor de Inteligência também fala o telefone e
 * `core/` não importa `@/lib`. Re-exportado para as telas não mudarem de import.
 */
export { formatarTelefone } from '@/core/text/telefone'

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

/**
 * "14:30" a partir de um `timestamptz`, no fuso do NEGÓCIO.
 *
 * `timezone` é obrigatório (APR-019). Era opcional, com a premissa de que nas telas internas "o
 * fuso do navegador da profissional já é o do salão" — mas o HTML sai do SERVIDOR, que na Vercel é
 * UTC: medido, a Agenda mostrava 12:11 para 09:11 por até 1 s, até a hidratação trocar. No painel,
 * o fuso vem de `useFuso()`; na página pública, do negócio carregado.
 */
export function horaLocal(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
}
