/**
 * O nome que cada papel tem na tela, em português.
 *
 * Morava dentro de `admin/config/profissionais/lista.tsx`, um componente de cliente, e ia ganhar
 * uma segunda cópia no instante em que outra tela precisasse dizer "você entrou como Recepção".
 * Duas cópias da mesma tabela divergem com as duas suítes verdes — já aconteceu nesta base.
 *
 * Em `core/` porque é vocabulário de negócio sem I/O (regra 5 do `CLAUDE.md`), e por isso as
 * chaves são literais em vez de `Papel`: `core/` não importa de `server/`, onde o tipo mora. Quem
 * garante que esta lista e o `PERMISSIONS` do `rbac` falam dos mesmos papéis é
 * `tests/unit/core/papel-tem-um-rotulo-so.test.ts`, que compara as duas nas DUAS direções.
 */
export const ROTULO_DO_PAPEL = {
  owner: 'Dono',
  manager: 'Gerente',
  professional: 'Profissional',
  reception: 'Recepção',
  finance: 'Financeiro',
} as const satisfies Record<string, string>

export type PapelComRotulo = keyof typeof ROTULO_DO_PAPEL

/**
 * Papel desconhecido não vira `undefined` renderizado nem tela vazia: cai num rótulo genérico.
 * Um papel novo no `rbac` sem entrada aqui é defeito, e a guarda reprova — mas a tela de quem está
 * trabalhando não é o lugar de descobrir isso.
 */
export function rotuloDoPapel(papel: string): string {
  return ROTULO_DO_PAPEL[papel as PapelComRotulo] ?? 'Membro'
}
