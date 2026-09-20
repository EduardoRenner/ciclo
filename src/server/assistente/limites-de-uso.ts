/**
 * `docs/26-AGENTE-IA-PLANO.md` §4.4: teto por tenant e por usuário, para conter abuso — não para
 * conter custo normal (a R$ 0,004/pergunta o custo em si não justifica limite nenhum).
 *
 * Compartilhado entre `/api/v1/assistant` e `/api/v1/assistant/rapido` de propósito: as duas
 * rotas somam no MESMO balde (`assistant:tenant:<id>`/`assistant:usuario:<id>`) — o atalho sem
 * Gemini ainda é consulta ao banco por clique, e martelar sugestão prontas conta para o mesmo
 * teto de abuso que martelar pergunta livre.
 */
export const LIMITE_POR_TENANT_DIA = { limite: 60, janelaSegundos: 86_400 }
export const LIMITE_POR_USUARIO_HORA = { limite: 20, janelaSegundos: 3_600 }
