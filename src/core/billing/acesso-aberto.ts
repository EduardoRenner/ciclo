/**
 * Acesso aberto (decisão de 2026-10-07): enquanto a cobrança não está integrada, TODA conta usa o
 * produto inteiro, sem pagar, sem prazo e sem pausa. Uma chave só: `situacaoEmVigor` (prelancamento.ts) é o que o resto
 * do código consulta, e ela devolve o degrau mais alto, escrita liberada e nenhuma faixa.
 *
 * Mora num módulo só dele para o teste das regras do programa desligar a chave com `vi.mock`, sem mexer no código.
 *
 * Os dados da cortesia continuam sendo gravados no cadastro de propósito: desligar a chave
 * (`false`) devolve o programa original (cortesia, graça e pausa) sem migrar nada, e quem se
 * cadastrou durante o acesso aberto já chega com a data certa. Antes de desligar, é preciso ter
 * como cobrar e avisar, e conferir o que `/termos` §5 e §6 prometem.
 */
export const ACESSO_ABERTO = true
