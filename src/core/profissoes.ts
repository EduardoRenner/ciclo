/**
 * A profissão que existe para quem não se encontra nas outras.
 *
 * O catálogo tem 17 linhas, e a busca do onboarding respondia "Nenhuma profissão encontrada." a
 * quem digitasse massoterapeuta, costureira, confeiteira ou qualquer coisa fora delas — na
 * PRIMEIRA tela depois de criar a conta, com `professionId` obrigatório no esquema da rota. Beco
 * sem saída no pior lugar que existe.
 *
 * A `0078` acrescentou a linha; esta constante é o nome dela no código, e mora em `core/` porque
 * a regra que depende dela é de domínio: **a genérica não responde os quatro eixos**. Quem escolhe
 * "Outra profissão" não disse como atende, e inventar a resposta esconderia módulo de quem precisa
 * dele, sem tela para corrigir depois. Ver `executarOnboarding`.
 *
 * Constante, e não uma consulta por `grupo = 'outros'`: é UMA linha específica, não uma categoria.
 */
export const SLUG_PROFISSAO_GENERICA = 'outra'
