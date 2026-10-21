# C-032 · AUT-105: o mecânico sem valor e sem contato — desenho medido, sem código ainda

**F1 · Objetivo:** o plano 106 pede o papel do mecânico que não vê valor nem telefone ("servidor manda
null"), e manda primeiro conferir o `professional` do CICLO. Número: superfície que o papel de hoje alcança.

**F2 · O que existe (`server/auth/rbac.ts`):** `professional` = `appointment:own`, `client:own`,
`vault:own`, `comanda:own`, `commission:own`, `legal:*`. Na beleza isso é desejado: a profissional liga
para a cliente e vê a própria comanda. Medido: **28 rotas da API** exigem uma dessas permissões e devolvem
ficha de cliente, agenda, comanda, carteira ou extrato; as telas de `/admin` buscam direto no servidor e
somam outra superfície. Hoje nada filtra campo por papel (o único "telefone nulo" é o do assistente de IA,
na fronteira do modelo).

**F3 · Desenho (decidido):**
- **Lista branca, não lista negra.** Anular telefone e valor campo a campo em 28 rotas e nas telas é
  frágil: toda rota nova vaza por padrão. O certo é um papel novo (`technician`, rótulo "técnico") SEM
  nenhuma das permissões acima, e uma rota própria da fila de execução que devolve só placa, veículo,
  itens a fazer e onde registrar medição (AUT-404). Por construção, nem contato nem valor sai dali.
- **Quando:** junto com a tela de execução (AUT-404, fase 4). Um papel sem tela hoje seria um papel
  morto (entra e não vê nada), e o pacote Oficina está fechado (C-031).
- **Guarda que vem junto:** o papel `technician` não pode ganhar nenhuma permissão `client:*`,
  `comanda:*`, `commission:*`, `report:*` nem `appointment:read`; e a rota da fila só seleciona colunas
  de uma lista fixa (casar o `select`, não o nome da rota).

**F4/F5:** sem código neste ciclo, de propósito. Medida: a superfície (28 rotas + telas) e a decisão
que troca 28 filtros por 1 rota de lista branca.

**Nota:** cliente 4 · segredo 6 · engenharia 8. **Próximo (C-033):** algoritmo (regra ≥ 1 a cada 3; o
último foi o C-030).
