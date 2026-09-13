# 62 · Aba "Hoje" + produtos de revenda/upsell — análise e plano

Continuação de `docs/61`, depois de três rodadas de conversa com o Eduardo: (1) crítica da aba
Hoje, (2) achado de que `products` já tem `price_cents`/`is_retail` desde a `0001` mas nenhuma
tela usa isso, (3) pedido de plano de implementação do conjunto. Este documento é esse plano.

---

## Parte 1 · Análise complementar

### 1.1 · O que faltou dizer sobre produtos de revenda

Uma correção ao que eu disse antes de olhar mais fundo: **existe um caminho hoje**, mas só pelo
assistente de IA (`server/assistente/ferramentas.ts`, ferramenta de "lançar produto extra na
comanda de um atendimento concluído") — ele já lê `listarProdutosAtivos` (só `is_retail = true`,
com preço do catálogo) e sabe montar a proposta certa. Ou seja, o **motor está pronto nos dois
lugares** (comanda em aberto e comanda já fechada via assistente); só falta a mesma capacidade
existir como **botão**, para quem não usa ou não confia no assistente — que hoje é a maioria, já
que o assistente exige `GEMINI_API_KEY` configurada e módulo habilitado.

Três coisas que a análise anterior não cobriu:

1. **Margem por produto é dado morto.** Com custo (`avg_cost_cents`) e preço (`price_cents`) na
   mesma linha, a margem é uma subtração — e não aparece em lugar nenhum. Isso é exatamente o tipo
   de número que justifica revenda (ex.: xampu custa R$ 8, vende por R$ 35 → margem melhor que
   metade dos serviços do salão, e ninguém sabe disso hoje).
2. **Estoque parado de revenda é oportunidade, não só alerta de recompra.** Hoje o alerta de
   estoque (`alertas-estoque.ts`) só dispara por ponto de pedido ou validade. Produto de revenda
   com estoque alto e zero venda no mês é o oposto — "sobrando, não empurrando" — e é o tipo de
   sinal que a Central de Ações da aba Hoje já sabe apresentar bem (padrão dos cards
   "Vale a pena hoje").
3. **RBAC e RLS já resolvidos.** `inventory:*` (owner/manager) já cobre escrita em `products`, e a
   política RLS da `0075` já restringe `insert`/`update`/`delete` a quem tem essa permissão. **Não
   precisa de migration nova** para o que este plano propõe — é trabalho de aplicação (rota + UI),
   não de banco.

### 1.2 · Fechando a análise da aba Hoje (prioridade, não lista nova)

Das ideias da rodada anterior, a ordem de valor por esforço:

| Ideia | Esforço | Por quê primeiro/depois |
|---|---|---|
| WhatsApp direto no card "A seguir" | Baixo | Um ícone, reusa link que `DetalheAgendamento` já monta |
| Comparação com a média (herói "hoje vs. costume") | Médio | Precisa de agregado novo, mas é só leitura |
| Timeline visual do dia | Médio-alto | Componente novo; maior ganho perceptível, maior risco de ficar poluído em tela de 375px |
| Visão por profissional (quem trabalha hoje) | Alto | Só faz sentido pra quem tem equipe (plano `equipe`+) — não é P0 |

Fica registrado; a Parte 2 não inclui essas por escolha — o pedido desta rodada foi focar no plano
de produtos/upsell, que é o achado maior. Se o Eduardo quiser, a Fase 4 abaixo tem espaço reservado
pra puxar 1-2 dessas junto.

---

## Parte 2 · Plano de implementação — produtos de revenda e upsell

### Fase 1 · Cadastro de produto (o alicerce que falta)

**Por que primeiro:** as fases 2 e 3 não têm o que mostrar sem isto. Hoje um produto só nasce do
pacote inicial do nicho — depois do onboarding, é impossível cadastrar um novo.

- **Rota** `POST /api/v1/products` e `PATCH /api/v1/products/:id`, espelhando
  `services` (`server/services/servicos.ts` é o template mais próximo: mesmo dono de dados, mesmo
  formato de resposta, mesma trava de RBAC `inventory:create`/`inventory:update`).
  - Campos: `name`, `unit`, `avgCostCents` (custo inicial, opcional — pode nascer 0 e crescer por
    entrada de estoque), `priceCents` (obrigatório **só se** `isRetail = true` — zod com
    `.refine`, mesmo padrão de `EsquemaEntradaEstoque`), `isRetail`, `reorderPoint`.
  - Zod na borda (regra 7): preço em centavos, nunca float (regra 3).
- **UI**: `/admin/estoque/novo` (form) + editar direto na lista (`estoque/lista.tsx` ganha um
  `Sheet` de edição, no padrão de `profissionais/formulario.tsx`).
  - Campo central que não existe hoje: toggle "Vende para cliente" (`is_retail`). Quando ligado,
    aparece o campo de preço; quando desligado, preço fica oculto (é insumo, o cálculo de custo já
    vem da ficha de consumo do serviço).
  - Copy do toggle tem que deixar claro a diferença (o comentário de `comanda.ts:148-155` já tem a
    explicação certa — "revenda: shampoo, óleo de barba, protetor solar, que a cliente leva pra
    casa; insumo: água oxigenada, luva, navalha, que o serviço consome" — reaproveitar isso na
    tela, não reinventar).
- **`estoque/page.tsx`** precisa buscar `price_cents` e `is_retail` no `select` (hoje não busca —
  é a lacuna medida em `docs/62 §1.1` acima).
- **Critério de aceite:** dá pra cadastrar um produto novo do zero, marcar como revenda, dar preço,
  e ele aparece separado dos insumos na lista.
- **Teste:** caminho feliz (cadastra revenda com preço) + caminho de erro (marca revenda sem
  preço → `VALIDATION_ERROR`, mensagem que diz o que fazer, não só "confira os campos").

### Fase 2 · Estoque separa revenda de insumo

**Por que depois da Fase 1:** só faz sentido ver os dois grupos separados depois que dá para
diferenciar um do outro na criação.

- `estoque/lista.tsx` vira duas seções (`SectionHeader`): **"Para revenda"** (nome, preço, margem
  calculada — `priceCents - avgCostCents`, em `%` e em R$) e **"Uso interno"** (nome, custo,
  consumo — sem preço, porque não tem).
- Margem em vermelho/laranja quando negativa ou muito baixa (produto vendido abaixo do custo é bug
  de precificação que o dono precisa ver, não só um número neutro).
- **Critério de aceite:** abrir `/admin/estoque` com produtos dos dois tipos mostra duas listas
  claramente diferentes, com margem visível na de revenda.

### Fase 3 · Comanda ganha "Adicionar produto"

**O gap mais visível do achado original.** Hoje `comanda.tsx:192-228` só tem "Adicionar item" com
dropdown de serviços.

- Vira duas ações lado a lado (ou uma aba/toggle): **Serviço** e **Produto**. Produto usa
  `listarProdutosAtivos` (já existe, já filtra `is_retail`) — zero trabalho de backend novo aqui,
  `adicionarItemComanda` já aceita `productId` desde sempre.
- Preço vem do catálogo automaticamente (mesma regra do assistente: nunca perguntar preço, ele
  "sai sozinho" — `ferramentas.ts:504`, "NUNCA informe preco: o preco sai do catalogo sozinho").
- **Critério de aceite:** fechando uma comanda, dá pra adicionar "Shampoo X" como item, o preço
  vem certo, o estoque desce, o lucro da comanda reflete a margem do produto.
- **Teste:** mistura serviço + produto na mesma comanda e confere que `recalcularSubtotal` soma os
  dois certo (a função já existe e já é chamada — é teste de regressão, não de função nova).

### Fase 4 · Ganchos de upsell (o que o Eduardo pediu para "estruturar depois")

Só depois que 1-3 estão no ar — sem produto cadastrado com preço e sem comanda que vende produto,
não há dado para sugerir nada.

- **Card na Central de Ações** ("Vale a pena hoje"): "Você tem revenda parada" — produto
  `is_retail` com `stock_qty` alto e zero saída por venda (não por consumo de serviço) nos
  últimos 30 dias. Mesmo padrão dos cards existentes (`crm.ts`), mesma régua de nunca aparecer
  vazio à toa.
- **Sugestão pós-atendimento**: quando a comanda fecha um serviço que tem produto de revenda
  relacionado (ex.: coloração → produto de manutenção de cor), sugerir no momento do fechamento —
  isto pede uma tabela de relação serviço↔produto-sugerido, que **não existe ainda** e é a única
  peça desta fase que precisa de schema novo. Decisão de escopo: fica para quando as fases 1-3
  estiverem validadas com uso real, não antes — construir a régua de sugestão sem ver um caso real
  de venda é adivinhação.
- **Assistente** ganha o mesmo dado (já tem acesso a `listarProdutosAtivos`) para responder "o que
  vale a pena eu empurrar hoje" quando perguntado — sem ferramenta nova, é prompt/contexto.

---

## Ordem de execução recomendada

`Fase 1 → Fase 2 → Fase 3 → (validar com uso real) → Fase 4`. As três primeiras são um ticket
plausível cada (meio dia de trabalho, no ritmo desta base); a Fase 4 é deliberadamente vaga porque
depende de dado que só existe depois que 1-3 rodam de verdade.

**Decisão de escopo, registrada aqui para não reabrir a pergunta:** a Fase 4 (relação
serviço↔produto-sugerido) fica fora deste ciclo de implementação. Motivo: `CLAUDE.md` — não criar
schema para hipótese sem dado real que a valide. Se o Eduardo quiser adiantar mesmo assim, é uma
conversa separada, não uma decisão que esta sessão toma sozinha.
