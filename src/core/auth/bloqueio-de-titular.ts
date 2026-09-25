/**
 * A frase que trava a exclusão de conta de quem é dono de um negócio com mais gente na equipe.
 *
 * Mandava "fale com o suporte para transferir". Suporte não é um lugar: sem canal de contato
 * configurado (`lib/contato.ts`, e produção não tem nenhum), a pessoa ia procurar uma porta que não
 * existe. Mesmo desenho do vazio de Recuperar (`core/ciclo/vazio-de-recuperar.ts`): a copy conhece
 * os dois estados do mundo, e sem canal ela não convida (`docs/82` §16, rodada 26).
 */
export function bloqueioDeTitularSemSucessor(temCanalDeContato: boolean): string {
  const base =
    'Você é dona ou dono de um negócio com mais gente na equipe. Antes de excluir sua conta, alguém precisa assumir como titular.'
  return temCanalDeContato ? `${base} Fale com a gente para transferir.` : base
}
