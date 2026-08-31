/**
 * Guarda nome/telefone/token de reconhecimento (`docs/34-PAGINA-PUBLICA-PLANO.md`, Fase 2) só no
 * `localStorage` do navegador de quem agendou — nunca em cookie, nunca em URL, nunca no servidor
 * além do próprio token assinado (`server/services/reconhecimento.ts`). Por chave separada por
 * `slug`: o mesmo aparelho pode agendar em salões diferentes, e um não pode vazar o telefone do
 * outro.
 *
 * `localStorage` pode lançar (navegação privada em alguns navegadores) ou simplesmente não
 * persistir — os dois casos são silenciosos de propósito, porque isto é conveniência de UI
 * (poupar digitação, sugerir o próximo horário), nunca algo de que o agendamento dependa.
 */
export type ReconhecimentoLocal = { name: string; phone: string; token: string }

function chave(slug: string): string {
  return `ciclo:reconhecimento:${slug}`
}

export function lerReconhecimentoLocal(slug: string): ReconhecimentoLocal | null {
  try {
    const bruto = window.localStorage.getItem(chave(slug))
    if (!bruto) return null
    const dados = JSON.parse(bruto) as unknown
    if (
      dados &&
      typeof dados === 'object' &&
      typeof (dados as ReconhecimentoLocal).name === 'string' &&
      typeof (dados as ReconhecimentoLocal).phone === 'string' &&
      typeof (dados as ReconhecimentoLocal).token === 'string'
    ) {
      return dados as ReconhecimentoLocal
    }
    return null
  } catch {
    return null
  }
}

export function salvarReconhecimentoLocal(slug: string, dados: ReconhecimentoLocal): void {
  try {
    window.localStorage.setItem(chave(slug), JSON.stringify(dados))
  } catch {
    // Sem persistência: a próxima visita só não vem com nome/telefone pré-preenchidos.
  }
}
