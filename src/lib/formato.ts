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
 * Input de preço em reais (o que a pessoa digita, "35,90" ou "35.90") vira
 * centavos (o que o banco guarda, regra 3 do CLAUDE.md — dinheiro nunca em
 * float). `null` quando o texto não é um número válido — quem chama decide o
 * erro de campo, esta função não lança.
 */
export function paraReaisCentavos(texto: string): number | null {
  const normalizado = texto.trim().replace(/\./g, '').replace(',', '.')
  if (!normalizado) return null
  const valor = Number(normalizado)
  if (!Number.isFinite(valor) || valor < 0) return null
  return Math.round(valor * 100)
}

/** Inverso de `paraReaisCentavos` — para preencher o input ao editar. */
export function centavosParaReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}
