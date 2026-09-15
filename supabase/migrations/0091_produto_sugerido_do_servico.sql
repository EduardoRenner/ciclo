-- =====================================================================
-- CICLO · produto sugerido no momento de marcar (migration 0091)
--
-- Pedido direto do Eduardo em 15/09: quando a cliente marca um serviço, oferecer um produto de
-- revenda relacionado (ex: corte de cabelo → máscara de hidratação), sem desconto automático
-- (proibido em `core/agenda/ociosidade.ts`) e sem prazo/contador inventado (`docs/30` §5.10).
--
-- `service_products` (ficha de consumo) NÃO serve pra isto: ela é insumo GASTO durante o
-- atendimento (0,5 sachê de água oxigenada), não produto vendável relacionado. Reaproveitá-la
-- misturaria as duas coisas na mesma lista.
--
-- Em vez de uma tabela nova (N produtos por serviço), uma coluna: no MVP o dono escolhe NO MÁXIMO
-- um produto por serviço para sugerir. `docs/62` Fase 4 tinha adiado a tabela de relação
-- serviço↔produto-sugerido por falta de dado real que justificasse o desenho — aqui o pedido já é
-- real e o desenho mais simples que atende é uma FK, não uma tabela de N-para-N.
--
-- `on delete set null`: apagar o produto (soft delete real seria outra coisa, mas `products` tem
-- `deleted_at`) não pode derrubar o serviço nem travar a exclusão — a sugestão só some.
-- =====================================================================

alter table services
  add column suggested_product_id uuid references products(id) on delete set null;

-- Índice: toda leitura de `agendar.tsx` filtra por serviço e junta o produto sugerido — sem
-- índice, a FK ainda funciona, só o plano de consulta que degrada.
create index services_suggested_product_id_idx on services(suggested_product_id) where suggested_product_id is not null;

comment on column services.suggested_product_id is
  'Produto de revenda oferecido no momento de marcar este serviço (0091). Null = sem sugestão.';
