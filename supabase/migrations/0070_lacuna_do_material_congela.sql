-- CICLO · a lacuna do material passa a ser registro, e não uma pergunta refeita todo dia
--
-- ## O defeito
--
-- `ticket_items.cost_cents` é congelado no lançamento do item — é o material daquele atendimento,
-- calculado com a ficha e o custo do produto VIGENTES naquele momento. A faixa da comanda que
-- avisa "falta descontar o produto", porém, é recalculada a cada abertura da tela, sobre o estado
-- de HOJE de `service_products` e `products.avg_cost_cents`.
--
-- As duas coisas divergem, e a divergência é silenciosa:
--
--   1. o dono fecha uma comanda em agosto sem ter registrado a compra da tintura →
--      `cost_cents = 0` e a faixa avisa, corretamente;
--   2. em outubro ele registra a compra → `avg_cost_cents` deixa de ser zero;
--   3. a comanda de AGOSTO para de exibir a faixa — e o `material_cost_cents` dela continua zero.
--
-- O número segue errado e o aviso sumiu. A regra que isso quebra é a mesma que a `0066` escreveu
-- para a taxa: *"o lucro é registro, não view"* — se a comissão mudar em novembro, o lucro de
-- agosto não muda junto. Vale para o valor e vale para a ressalva sobre ele.
--
-- Na direção oposta o estrago é o mesmo: apagar uma linha da ficha faz comandas antigas, fechadas
-- com material correto, começarem a acusar lacuna que nunca existiu.
--
-- ## Por que no ITEM, e não na comanda
--
-- Porque é o item que carrega o custo congelado. `cost_cents` e a ressalva sobre ele nascem da
-- mesma consulta, no mesmo instante, e separá-los recriaria — um nível abaixo — exatamente a
-- divergência que esta migration existe para fechar. A comanda agrega os itens dela; não guarda
-- uma segunda cópia da resposta.
--
-- ## Vale para produto de revenda também
--
-- `adicionarItemComanda` calcula o custo de um item de produto como `qty × avg_cost_cents`. Um
-- produto de revenda que nunca teve compra registrada entra com custo zero e infla o lucro do
-- mesmo jeito que o insumo — a diferença é que ninguém tinha olhado para esse caminho.
--
-- ## O padrão do valor default
--
-- `false` para as linhas que já existem, e isso é uma escolha consciente: elas foram lançadas sob
-- o custo semeado pelo pack (ver `0069`), então a lacuna delas é real e este default a esconde. A
-- alternativa — marcar tudo que é antigo como incerto — acusaria também quem sempre registrou as
-- compras direito, e trocaria um silêncio por um alarme falso que nunca se apaga. Entre os dois,
-- o silêncio no passado é o menos pior: é o presente que precisa ficar certo, e as comandas
-- fechadas são registro contábil que a `0069` já decidiu não reescrever.

alter table ticket_items
  add column material_incerto boolean not null default false;

comment on column ticket_items.material_incerto is
  'O `cost_cents` deste item não é o custo de verdade, CONGELADO no lançamento: o serviço não tinha ficha de consumo, ou algum produto dela (ou o próprio produto de revenda) nunca teve compra registrada. Nunca recalcular a partir do estado de hoje -- ver docs/51 e o cabeçalho desta migration.';
