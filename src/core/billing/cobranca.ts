/**
 * A chave da cobrança do CICLO (docs/114 L-01): o lançamento é grátis (decisão do Vitor, 21/10).
 *
 * Desligada, pagamento, planos e "assinar" saem da tela: `/precos` vira "grátis no lançamento",
 * "Meu plano" sai das Configurações e as rotas de assinar e cancelar respondem 404. O código de
 * cobrança continua no lugar: ligar a chave devolve tudo como era.
 *
 * Constante no código, no molde de `ACESSO_ABERTO` e `OFICINA_ABERTA`: ligar é decisão do Vitor e
 * vem junto com conferir `/termos` §5 e §6 e o aviso a quem já usa, nunca por variável trocada no
 * painel sem deploy.
 */
export const CICLO_COBRANCA = false
