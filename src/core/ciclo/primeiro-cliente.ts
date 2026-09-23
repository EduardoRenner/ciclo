/**
 * A primeira vitória do onboarding não é criar a conta — é cadastrar a primeira pessoa que volta.
 * `docs/61-EXPERIENCIA-DE-USO-PLANO.md` §5.6: essa é a confirmação que decide se quem acabou de
 * abrir o CICLO sente que já colocou alguma coisa em movimento, ou só preencheu mais um formulário.
 *
 * Função pura, sem gênero na frase (não existe helper de concordância de gênero nesta casa —
 * `core/text/vocabulario.ts` não tem um, e "Primeira cliente"/"Primeiro cliente" exigiria
 * escolher um), e sem a palavra banida `aprende` (`home-nao-promete-demais.test.ts`): o motor
 * "acompanha", não "aprende".
 */
export function mensagemDeClienteCadastrado(ehPrimeiro: boolean): { titulo: string; descricao?: string } {
  if (!ehPrimeiro) return { titulo: 'Cliente cadastrado' }

  return {
    titulo: 'Cliente cadastrado',
    descricao: 'O primeiro da casa. Marque o horário para o Motor de Ciclo começar a acompanhar o retorno.',
  }
}
