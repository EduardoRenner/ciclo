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
  privacidade: '2026-10-03',
} as const

export type DocumentoLegal = keyof typeof VERSOES_LEGAIS

/**
 * O que mudou em cada versão, em uma ou duas frases para o dono da conta, escrito por quem mudou o
 * texto. A tela de aceite mostra o da versão em vigor; **uma guarda exige que exista um resumo para
 * a versão atual de cada documento**, então trocar a data em `VERSOES_LEGAIS` sem escrever o que mudou
 * reprova (senão o dono seria convidado a aceitar sem saber o quê).
 *
 * Chave = a data da versão. Versões antigas ficam: servem de histórico do que cada aceite aceitou.
 */
export const RESUMO_DA_VERSAO: Record<DocumentoLegal, Record<string, string>> = {
  termos: {
    '2026-09-21': 'Versão anterior ao período de uso sem cobrança.',
    '2026-10-03':
      'Os termos passam a descrever o período de uso sem cobrança, os dois planos (Solo e Equipe), a pausa da conta depois desse período e a exportação da base inteira. A limitação de responsabilidade deixou de citar o plano gratuito.',
  },
  privacidade: {
    '2026-09-16': 'Versão anterior à lista completa de quem recebe dados.',
    '2026-10-03':
      'A lista de quem recebe dados agora diz o que cada um recebe e onde processa. A política deixou de dizer que todos os servidores ficam no Brasil: só o banco de dados e as funções ficam. E passou a dizer que as telas só falam com o CICLO e com o banco.',
  },
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "2026-09-21" → "21 de setembro de 2026", como a página sempre mostrou. */
export function dataLegivel(versao: string): string {
  const [ano, mes, dia] = versao.split('-').map(Number)
  return `${dia} de ${MESES[mes! - 1]} de ${ano}`
}
