-- CICLO · o pack de profissão para de inventar quanto o salão paga no produto
--
-- ## O defeito, medido em 2026-09-06
--
-- `apply_vertical_pack` (0002, §"produtos") cria os produtos do pack já com
-- `avg_cost_cents` preenchido pelo catálogo — e o catálogo tem preço em todos eles. No pack de
-- cabelo (0057): tintura R$ 22,00 o tubo, água oxigenada R$ 0,03 o ml, luva R$ 0,40 a unidade.
-- Na mesma função, logo abaixo, ele semeia a ficha de consumo ligando esses produtos aos
-- serviços.
--
-- O resultado, para um salão de cabelo criado hoje, é uma "Coloração / retoque de raiz" de
-- R$ 180,00 que já nasce com R$ 24,60 de material — sem que ninguém tenha comprado nada.
--
-- E o pior não é o valor: é que ele passa despercebido. `custoDoServico` conta como lacuna o
-- produto com `avg_cost_cents = 0`, e `contarServicosSemFicha` conta o serviço sem ficha. O
-- custo semeado não é nenhum dos dois — tem ficha e tem custo — então a comanda fechada exibia
-- "Sobrou R$ X" **sem uma única ressalva**, com um quarto do material saindo de um número que o
-- CICLO escreveu sozinho.
--
-- É exatamente o que o `docs/47` P05 acusa o setor de fazer, e o que o `docs/48` §Fase 3 proíbe
-- em todas as letras: *estado incompleto honesto, nunca número inventado*. O `docs/50` §5 chegou
-- a escrever a regra ("Não semear custo de produto. Nunca.") supondo que ela já valia; §1 daquele
-- mesmo documento afirma que `service_products` está vazia. As duas coisas eram falsas desde a
-- 0002.
--
-- ## O que esta migration faz, e o que ela deliberadamente NÃO faz
--
-- Zera o custo no CATÁLOGO dos packs, para todo tenant criado daqui em diante. A quantidade da
-- ficha continua intacta: "uma coloração gasta um tubo de tintura e 60 ml de oxigenada" é
-- conhecimento de ofício e o pack tem toda razão de saber isso. Quanto aquele salão pagou no
-- tubo, só a compra dele responde — é a divisão que o `docs/50` L-03 desenha.
--
-- Não mexe em produto que já teve compra registrada. O critério é objetivo e não depende de
-- adivinhar intenção: `registrarEntradaEstoque` (`services/estoque.ts`) é o ÚNICO escritor de
-- `avg_cost_cents` no projeto inteiro, e ele sempre grava um `stock_moves` de `source='purchase'`
-- na mesma operação. Produto com custo e sem nenhuma compra é, por construção, produto semeado.
--
-- Não apaga movimento de estoque nem linha de ficha (regra 11 do `CLAUDE.md`), e não toca em
-- `tickets.material_cost_cents` de comanda já fechada: aquele número é registro contábil
-- congelado, e reescrevê-lo agora faria o caixa de agosto mudar em setembro. As comandas fechadas
-- sob o custo semeado continuam como estão — o `docs/51` registra quantas são e por quê.

-- ---------------------------------------------------------------------
-- 1. O catálogo para de trazer preço
-- ---------------------------------------------------------------------
update vertical_packs
set products = (
  select coalesce(jsonb_agg(jsonb_set(produto, '{avg_cost_cents}', '0'::jsonb)), '[]'::jsonb)
  from jsonb_array_elements(products) as produto
)
where products is not null
  and exists (
    select 1 from jsonb_array_elements(products) as p
    where coalesce((p->>'avg_cost_cents')::bigint, 0) <> 0
  );

comment on column vertical_packs.products is
  'Os insumos que a profissão usa, com unidade e ponto de reposição. `avg_cost_cents` nasce ZERO de propósito desde a 0069: o pack sabe o que o serviço gasta, nunca quanto aquele salão pagou. Quem escreve o custo é a compra, em registrarEntradaEstoque.';

-- ---------------------------------------------------------------------
-- 2. O custo já semeado volta a ser o que sempre foi: desconhecido
-- ---------------------------------------------------------------------
update products p
set avg_cost_cents = 0
where p.avg_cost_cents <> 0
  and not exists (
    select 1 from stock_moves m
    where m.product_id = p.id
      and m.tenant_id = p.tenant_id
      and m.source = 'purchase'
  );
