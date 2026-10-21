/**
 * Quem da equipe recebe um aviso no celular (docs/112 EXP-A06).
 *
 * Até 21/10/2026 o push ia para todo aparelho inscrito no negócio, e o corpo leva o nome da
 * cliente. Com a visão restrita ligada (`restrict_professional_view`), uma profissional lia na
 * tela bloqueada quem a outra ia atender. A regra: recebe quem administra (dona, gerência e
 * recepção, que já veem a agenda de todas) e a profissional do horário, se houver uma.
 */
const QUEM_ADMINISTRA = new Set(['owner', 'manager', 'reception'])

export type MembroDaEquipe = { userId: string; role: string; active: boolean }

export function destinatariosDoAvisoDaEquipe(
  membros: readonly MembroDaEquipe[],
  usuarioDaProfissional: string | null,
): Set<string> {
  const quem = new Set<string>()
  for (const m of membros) {
    if (!m.active) continue
    if (QUEM_ADMINISTRA.has(m.role) || m.userId === usuarioDaProfissional) quem.add(m.userId)
  }
  return quem
}
