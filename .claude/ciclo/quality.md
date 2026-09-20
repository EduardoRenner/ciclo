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

---

## 2026-09-20 · Missão de crescimento — retorno ao código depois da pesquisa de mercado, 12 achados

Depois da fase de pesquisa (growth-map/funnel/market-intelligence/growth-opportunities, ver
`docs/DECISOES.md`), a sessão voltou a ler código sistematicamente. Doze achados reais, em duas
famílias:

**Seis conserto de comportamento (BL-15 a BL-20):**
1. `verificarCaptcha` tratava status de erro do provedor como reprovação silenciosa (não caía no
   `catch` que já loga indisponibilidade).
2. `job-queue.ts`: `finish_job(done)` falhando depois de um handler bem-sucedido reexecutava o
   job — latente (`HANDLERS` vazio hoje), mas alcançável no primeiro handler real.
3-4. `lembretes.ts`/`recuperar-receita.ts`: item com erro abortava o lote inteiro de envio —
   mesma classe já corrigida em `recompute-cycles`/`segments`/`campanhas`/`stock-alerts`, essas
   duas ficaram de fora da varredura anterior.
5. `resolverCliente` (o caminho de criação de cliente mais usado do produto): corrida de
   criação por telefone novo não tratava `23505` — inconsistente com o `23P01` do mesmo arquivo.
6. `estoque.ts`: `stock_qty`/`avg_cost_cents` perdiam escrita em corrida (ler-somar-escrever sem
   CAS), duplicado em duas funções independentes.

**Seis consolidações de "mesma fórmula duplicada" (BL-21 a BL-26)**, achadas varrendo `src/core`,
`src/server` e `src/app` por nome de função repetido: `diasEntre` (2 cópias), `mediana` (3 cópias),
`voltas()` (2 cópias), `weekdayPg` (4 cópias — a maior), `mesCorrente` (2 implementações
DIFERENTES que já podiam ter divergido), `horaLocal` (3 cópias, uma com assinatura
deliberadamente diferente). Descartados como falso positivo na mesma varredura: `paraColunas` e
`traduzirErro` (mesmo nome, corpos diferentes por entidade — padrão repetido por design).

**Por que a segunda família rendeu tanto:** a primeira consolidação (`resolverCliente`, achado 5)
levou a comparar com o padrão irmão já correto (`criarAgendamento`'s `23P01`), e isso puxou o fio
de "que outras fórmulas pequenas existem em mais de um lugar" — uma classe de achado diferente de
bug-hunting tradicional (não é comportamento errado hoje, é risco de divergência futura), mais
barata de achar (grep por nome) e mais barata de consertar (mover código, sem lógica nova) que os
achados de corrida.

Toda extensa varredura de segurança/confiabilidade file-por-file (CSP, webhooks, rate limit, MFA,
exclusão de conta, cofre/KEK, service worker, middleware, core do Motor de Ciclo) não achou mais
nada além destes doze — consistente com a nota de ritmo anterior: a superfície de alto risco já
estava bem coberta, e o valor novo veio de uma classe de busca diferente (fórmula duplicada), não
de mais leitura linha a linha.
