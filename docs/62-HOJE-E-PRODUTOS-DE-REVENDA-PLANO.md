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

### 1.2 · Fechando a análise da aba Hoje

Medido no código (não só opinião): nenhuma das quatro ideias tem trabalho de banco/migration —
são leitura de dado que já existe (2), mais um agregado novo simples (1) e um componente de
apresentação (1). A ordem de valor por esforço, que a Parte 3 implementa nessa sequência:

| Ideia | Esforço | Por quê nessa posição |
|---|---|---|
| WhatsApp direto no card "A seguir" | Baixo | Falta só o telefone no `select`; o link já existe em `DetalheAgendamento` |
| Comparação com a média (herói "hoje vs. costume") | Médio | Precisa de um agregado novo (não existe hoje), mas é só leitura |
| Timeline visual do dia | Médio-alto | Componente novo; maior ganho perceptível, maior risco de poluir a tela em 375px |
| Visão por profissional (quem trabalha hoje) | Alto | Só faz sentido pra quem tem equipe (plano `equipe`+) — não é P0 |

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

**Decisão de escopo, registrada aqui para não reabrir a pergunta:** a Fase 4 (relação
serviço↔produto-sugerido) fica fora deste ciclo de implementação. Motivo: `CLAUDE.md` — não criar
schema para hipótese sem dado real que a valide. Se o Eduardo quiser adiantar mesmo assim, é uma
conversa separada, não uma decisão que esta sessão toma sozinha.

---

## Parte 3 · Plano de implementação — aba Hoje

### Fase A · WhatsApp direto no card "A seguir"

**O de menor esforço e maior frequência de uso.** Hoje, pra chamar o próximo cliente no WhatsApp,
é: tocar no card → abrir o sheet → achar o botão. Vira um ícone no próprio card.

- `resumo-hoje.ts`: `COLUNAS_HOJE` ganha `phone` dentro de `clients(...)` (hoje só busca `name` e
  `health_records`), e o tipo `LinhaHoje` recebe `phone: string | null`.
  - **Sem telefone, sem ícone** — nunca inventar contato. Client sem `phone` cadastrado mantém o
    card como está hoje (só abre o sheet).
- `hoje.tsx`: o card de "A seguir" ganha um botão de ícone (WhatsApp) ao lado do
  `AppointmentRow`, fora da área de toque que abre o sheet (dois alvos empilhados — cuidado com o
  `toque-48` de dois elementos na mesma linha, armadilha já catalogada no `CLAUDE.md`; solução
  testada nesta base é `flex` com `gap`, não texto corrido).
  - Mensagem sai de um texto pronto, não texto livre — mesmo padrão de `mensagens-prontas.ts`
    ("Confirmando: {{servico}} às {{hora}}"), preenchido com o que a linha já tem em mãos.
- **Critério de aceite:** card "A seguir" com cliente que tem telefone mostra o ícone; tocar nele
  abre o WhatsApp com a mensagem pronta, sem sair da aba Hoje. Cliente sem telefone: sem ícone,
  sem erro.
- **Teste:** unit no componente (ícone aparece/some conforme `phone`), sem precisar de E2E.

### Fase B · "Hoje comparado ao costume"

**A pergunta que o herói não responde:** R$ 240 hoje é bom ou ruim pra este salão? Hoje não tem
referência nenhuma.

- Novo agregado em `resumo-hoje.ts` (ou serviço próprio, se a função já estiver grande):
  receita média dos últimos N dias **do mesmo dia da semana** (domingo compara com domingos, não
  com a semana toda — um salão fechado no domingo não pode comparar "hoje" com uma média que
  inclui os dias que ele não abre). `N` sugerido: 4 semanas — amostra pequena o bastante pra
  refletir o salão de agora, grande o bastante pra não ser 1 dia de sorte/azar.
  - **Piso de amostra**: com menos de 2 ocorrências do mesmo dia da semana no histórico (salão
    muito novo), a comparação não aparece — mostrar "23% acima do costume" com uma amostra de 1
    dia é o tipo de número que a casa já sabe que engana (`docs/`
    [[guarda-que-varre-passa-vazia]]/"o piso é o positivo conhecido, não a contagem").
- `hoje.tsx`: linha de apoio no herói (quando `heroi === 'atendido'`) ganha o comparativo, no
  mesmo tom textual de "3 previsões recalculadas" — número como prova, nunca "pronto!" seco.
  Exemplo: `R$ 240,00 · 15% acima do que este domingo costuma render`. Sem comparação disponível
  (piso de amostra), a linha de apoio atual continua igual — a feature é aditiva, nunca some algo
  que já funcionava.
  - **Sem cor de julgamento** (verde "bateu a meta" / vermelho "não bateu"): é comparação
    informativa, não avaliação de desempenho — `docs/61 §5` já descartou reforço que possa soar
    como pressão.
- **Critério de aceite:** salão com histórico de pelo menos 2 domingos anteriores vê o comparativo
  na linha de apoio do herói "Atendido hoje"; salão novo não vê nada diferente do que já existe.
- **Teste:** função pura testável isoladamente (dado um array de receitas passadas + a de hoje,
  devolve `{comparavel: boolean, percentual: number}`), mesmo padrão de `escolherHeroi`.

### Fase C · Timeline visual do dia

**A maior mudança visual das quatro — pensar antes de construir.** Hoje a tela é uma lista
vertical; não dá pra ver "manhã cheia, tarde livre" sem rolar tudo.

- Componente novo (`components/ui/timeline-do-dia.tsx` ou nome equivalente): uma faixa horizontal
  ou vertical compacta representando o expediente do dia, com blocos ocupados (por status/cor, no
  mesmo `COR_BARRA` de `AppointmentRow` — reusar a paleta de estado, não inventar uma nova) e
  vazios.
  - **Medir antes de decidir o desenho definitivo**: a régua desta casa é `docs/61 §0` — subir e
    olhar em 375px antes de escolher entre faixa horizontal (rolável) ou lista compacta com
    marcadores de hora. Um mockup em código vale mais que a decisão de cabeça.
  - Toque num bloco abre o mesmo `Sheet` de detalhe que os cards já abrem — não duplicar a lógica
    de estado, só o resumo visual.
- **Risco documentado:** em dia com poucos agendamentos (a maioria dos casos hoje, pelos dados
  seedados), uma timeline pode parecer mais vazia/estranha que a lista atual — **testar com um dia
  cheio E um dia vazio antes de considerar pronto**, não só o caminho feliz.
- **Critério de aceite:** dá pra ver, sem rolar, a forma geral do dia (cheio/vazio, manhã/tarde) em
  375px, nos dois temas.
- Sem teste automatizado de layout (é visual) — verificação por screenshot no Browser pane, dos
  dois temas e dos dois cenários (dia cheio, dia vazio), documentada no PR.

### Fase D · Visão por profissional (quem trabalha hoje)

**Só para quem tem equipe — não é P0.** Fica de propósito por último e sem detalhamento de
implementação nesta rodada: depende de decisão de produto (isto entra em `/admin/hoje` como seção
nova, ou é uma tela própria tipo `/admin/agenda?por=profissional`, que já pode existir em forma
parecida na Agenda?) que vale conferir antes de desenhar — não vale a pena planejar em detalhe uma
fase que talvez já tenha equivalente em outra tela do app.

---

## Ordem de execução recomendada

Dentro de cada frente, a ordem já reflete valor/esforço. Entre as duas frentes — não há
dependência técnica entre "Hoje" e "produtos de revenda", podem intercalar à vontade. Sugestão,
juntando as duas listas por esforço crescente:

1. Fase A (WhatsApp no card) — menor esforço de tudo, ganho imediato.
2. Fase 1 (cadastro de produto) — alicerce da frente de revenda.
3. Fase B (comparação com a média).
4. Fase 2 (estoque separa revenda/insumo).
5. Fase 3 (comanda ganha "Adicionar produto").
6. Fase C (timeline do dia) — maior, e o CLAUDE.md pede medir em 375px antes de fechar o desenho.
7. Fase 4 (ganchos de upsell) e Fase D (visão por profissional) — as duas ficam para depois de
   validar as anteriores com uso real; nenhuma das duas é bloqueio pra nada.
