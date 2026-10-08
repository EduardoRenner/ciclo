/**
 * docs/101 T5.4: atalhos de teclado das filas (Hoje e Pendências) no computador. j e k andam pela fila, Enter
 * abre o item (é o próprio link focado), c faz a primeira ação do item ("Recebi", "Conferi" ou "Aprovar").
 *
 * "a adiar", do backlog, não existe: nada no pacote adia (prazo fatal não adia por regra do banco; pendência
 * não tem soneca). Um atalho para uma ação que a tela não tem seria tecla que não faz nada.
 *
 * Tecla com Ctrl, Cmd ou Alt é do navegador e do sistema; tecla dentro de campo é texto. As duas passam.
 */
export type ComandoDeTeclado = 'proximo' | 'anterior' | 'primeira_acao'

export type Tecla = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; emCampo: boolean }

export function comandoDaTecla(t: Tecla): ComandoDeTeclado | null {
  if (t.emCampo || t.ctrlKey || t.metaKey || t.altKey) return null
  if (t.key === 'j') return 'proximo'
  if (t.key === 'k') return 'anterior'
  if (t.key === 'c') return 'primeira_acao'
  return null
}

/** Para onde vai o foco. Sem item focado, j começa no primeiro e k também (não pula para o fim). */
export function indiceDepois(atual: number, total: number, comando: 'proximo' | 'anterior'): number | null {
  if (total === 0) return null
  if (atual < 0) return 0
  return comando === 'proximo' ? Math.min(atual + 1, total - 1) : Math.max(atual - 1, 0)
}

/** O alvo do evento é lugar de digitar? (o tipo vem do DOM, mas a regra é daqui) */
export function ehCampo(alvo: { tagName?: string; isContentEditable?: boolean; type?: string } | null): boolean {
  if (!alvo?.tagName) return false
  if (alvo.isContentEditable) return true
  const tag = alvo.tagName.toUpperCase()
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes((alvo.type ?? 'text').toLowerCase())
}
