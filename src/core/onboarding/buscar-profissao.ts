import { semAcento } from '@/core/text/normalizar'

export type ProfissaoBuscavel = { nome: string; sinonimos: readonly string[] }

/**
 * A busca da primeira tela do cadastro ("Qual é a sua profissão?").
 *
 * Saiu de `onboarding/formulario.tsx` (docs/112 EXP-S03) porque a tela pedia "Ex.: manicure, lash,
 * sobrancelha…" e "lash" não achava nada: Cílios não tinha sinônimo no banco. A pessoa caía em
 * "Seguir como Outra profissão" e a conta nascia sem serviço nenhum. Função pura para o teste
 * exercitar a MESMA busca que a tela usa, contra as linhas do banco de verdade.
 *
 * Ordem: quem casa pelo nome vem antes de quem casa só por sinônimo, e o começo da palavra antes do
 * meio. Dentro do mesmo peso fica a ordem que veio do banco (`posicao`), que é a de produto.
 */
export function buscarProfissoes<P extends ProfissaoBuscavel>(profissoes: readonly P[], busca: string): P[] {
  const termo = semAcento(busca)
  if (!termo) return [...profissoes]

  const peso = (p: P): number | null => {
    const nome = semAcento(p.nome)
    if (nome.startsWith(termo)) return 0
    if (nome.includes(termo)) return 1
    const sinonimos = p.sinonimos.map(semAcento)
    if (sinonimos.some((s) => s.startsWith(termo))) return 2
    if (sinonimos.some((s) => s.includes(termo))) return 3
    return null
  }

  return profissoes
    .map((p, i) => ({ p, i, peso: peso(p) }))
    .filter((x): x is { p: P; i: number; peso: number } => x.peso !== null)
    .sort((a, b) => a.peso - b.peso || a.i - b.i)
    .map((x) => x.p)
}
