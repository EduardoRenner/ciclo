/**
 * BL-50 — a versão em vigor de cada documento legal, num lugar só.
 *
 * É a data ISO em que o texto entrou no ar. A página mostra ela ("Atualizado em 21 de setembro de
 * 2026") e o cadastro grava ela em `terms_acceptances` (migration 0095). Uma constante para as duas
 * coisas é o que impede a página dizer uma data e a prova registrar outra.
 *
 * **Mudou o texto de `/termos` ou `/privacidade`? Mude a data aqui no mesmo commit.** Há teste que
 * confere o formato e que a página lê daqui; o que nenhum teste consegue saber é se o texto mudou —
 * isso é de quem edita.
 */
export const VERSOES_LEGAIS = {
  termos: '2026-09-21',
  privacidade: '2026-09-16',
} as const

export type DocumentoLegal = keyof typeof VERSOES_LEGAIS

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "2026-09-21" → "21 de setembro de 2026", como a página sempre mostrou. */
export function dataLegivel(versao: string): string {
  const [ano, mes, dia] = versao.split('-').map(Number)
  return `${dia} de ${MESES[mes! - 1]} de ${ano}`
}
