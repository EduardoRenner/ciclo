# Qualidade — evolução autônoma do produto

> Bugs, duplicação, dívida técnica, abstrações ruins — achados de leitura de código, não de uso.

---

## 2026-09-20 · Auditoria dirigida por churn: billing/pagamento e useOptimistic, sem achado

Estratégia desta rodada: em vez de ler arquivos ao acaso, usei `git log --since="7 days ago"
--name-only` para achar os arquivos mais mexidos na última semana — hipótese: código recente teve
menos rodadas de auditoria que o resto da base (extremamente polida, confirmado repetidas vezes
nesta sessão).

**Checado:** `admin/config/meu-plano/page.tsx` (6 mudanças, tela de cobrança — maior churn +
domínio sensível), `assinar-plano.tsx`, `cancelar-assinatura.tsx` (fluxo de pagamento MP), e o
`useOptimistic` introduzido em `agenda.tsx`/`detalhe.tsx` (630b7e0f, resposta otimista nas
transições de estado do agendamento).

**Resultado:** nada. Billing trata corretamente app nativo vs. web (T1.5, guideline 3.1.1 da
Apple), idempotência presente nos dois POSTs, paridade de cliques assinar/cancelar documentada e
implementada. `useOptimistic` está com o padrão certo — `aplicarStatusOtimista` chamado DENTRO de
`iniciarTransicao` (`useTransition`), que é a condição para o React reverter sozinho em caso de
falha (sem `onAtualizado()`, a transição termina sem atualizar `resumo`, e o valor otimista some).

**Por que registrar mesmo sem achado:** confirma que a área de maior risco (pagamento) e o padrão
mais novo/arriscado (estado otimista) desta semana estão corretos — não é "não procurei", é
"procurei e está certo". Poupa a próxima sessão de reabrir a mesma suspeita.

---

## 2026-09-20 · Generalização do achado BL-07 e checagem da Central de Ações — sem novo achado

Duas checagens depois de consertar `MoneyInput`:

1. **Os outros 3 componentes de input customizados** (`input.tsx`, `phone-input.tsx`, `select.tsx`)
   não compartilham o defeito do `MoneyInput` — todos eles ficam genuinamente vazios quando o
   estado do chamador começa vazio (string `''`), então `required` nativo funciona normalmente
   neles. O defeito era específico do `MoneyInput` formatar `centavos` como texto SEMPRE ("0,00"),
   não um padrão do design system.

2. **`central-de-acoes.tsx` + `centralDeAcoes` (`crm.ts`)** — lidos de ponta a ponta (as 6 consultas
   paralelas, os 6 cards de ação, a trava de `report:read`, o card de cobrança bloqueado no app
   nativo). Sem achado; já tem histórico de bugs reais corrigidos e documentados inline (limiar de
   pontos que ignorava o prêmio configurável, "147 clientes sumindo" que contava linha em vez de
   cliente). `acoesDeCompletude` — que o próprio código cita como já tendo tido uma guarda "cega"
   (espelhava a fórmula no teste em vez de chamar a função real) — está corrigida: o teste atual
   importa e chama a função de verdade.

Sem mudança de código nesta rodada; confirma que a área investigada está correta.

---

## 2026-09-20 · Varredura de fechamento: todos os usos de `linkWhatsApp` conferidos

Depois de BL-08/BL-09, `grep -rn "linkWhatsApp(" src --include="*.tsx"` achou 7 usos no total. Os
2 já corrigidos; os outros 5 (`[slug]/orcamento/pedido.tsx`, `[slug]/secoes.tsx`, `hoje.tsx`,
mais as duas instâncias já corrigidas de `ficha.tsx`) já usam o padrão certo —
`{link ? <a href={link}>...</a> : null}`, sem fallback `#` nem efeito colateral incondicional.
Confirma que a classe de defeito está fechada nesta base, não só nos dois lugares corrigidos.

---

## 2026-09-20 · Caixa (fechamento diário/mensal) e automações — checados, sem achado

Lidos `admin/caixa/page.tsx` (busca de dados, permissões `report:read`/`commission:read`/
`RELATORIO_DA_EQUIPE`), `caixa.tsx` (confirmado que `atendidoCents` só alimenta o texto do estado
vazio, nunca aparece como receita), `server/services/caixa.ts` (`somarTickets`/`fechamentoDiario`/
`resumoMensal` — soma em memória de colunas já calculadas por ticket, limite de fuso horário
tratado com `Temporal`, paginação com teto documentado) e `config/automacoes/automacoes.tsx`
(dial otimista com rollback, selo "roda de verdade" separado de "nível escolhido"). Sem achado em
nenhum.

**Nota de ritmo:** depois de ~10 ciclos consecutivos desta missão cobrindo praticamente toda
superfície de alto risco (pagamento, WhatsApp, formulários de dinheiro, guardas de varredura,
optimistic UI, caixa), a taxa de achados novos por leitura estática caiu bastante — 6 achados reais
consertados nesta sessão (2 de imagem, 1 de estado de carregamento, 2 de validação de dinheiro, 2
de link do WhatsApp que mentia sucesso), e as últimas 2-3 rodadas de leitura não acharam nada novo.
Não é sinal de parar — é sinal de que a próxima rodada de valor provavelmente vem de outra fonte
(teste ao vivo com dado real, ou uma área ainda não tocada como PWA/offline/push), não de reler mais
arquivos de admin ao acaso.

---

## 2026-09-20 · Segurança do assistente de IA (ações + contexto) — checada, exemplar

Lidos `core/assistente/acoes.ts` (mapa fechado de 5 ações → rota, IDs validados como UUID antes de
entrar na URL — nenhuma rota vem do modelo, só o nome da ação e o dado, evitando exatamente o
`docs/26 §4.3`) e os 9 arquivos de guarda em `tests/unit/assistente/` (65 testes, todos verdes).

Destaque: `contexto-do-modelo-nao-leva-saude.test.ts` documenta ter encontrado e consertado sua
PRÓPRIA guarda cega — a primeira versão testava só a função pura `semDadoDeSaude`, não o `executar`
da ferramenta `resumo_de_hoje` de verdade, e mutando (tirando a chamada do filtro) os testes
antigos continuavam verdes. A versão atual tem um segundo describe block que varre o SOURCE pra
confirmar que a ferramenta de fato chama o filtro, além de confirmar por varredura que nenhuma
ferramenta do assistente tem `.insert/update/upsert/delete/rpc(` — a regra "propõe, não escreve"
garantida pela ausência de escrita no código, não por instrução de prompt.

Sem achado — registrado porque é a peça mais sensível do produto (dado de saúde + ação autônoma de
IA) e vale confirmar que continua correta, não assumir.
