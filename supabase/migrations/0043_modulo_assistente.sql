-- docs/26-AGENTE-IA-PLANO.md §6 (ticket A6). Décimo sétimo módulo do catálogo — a 0041 já não
-- pode ser editada (aplicada em produção), então este entra como INSERT novo, não como alteração
-- daquela.
--
-- `sempre_ligado = false`: o dono precisa poder desligar (docs/26 §4.4, "interruptor"), mesmo
-- estando disponível para todo tenant desde o grátis. `tenant_modules` já sabe fazer isso — uma
-- linha ali com `origem = 'dono'` desliga; apagar a linha liga de volta (0041/comentário da
-- 18-MONETIZACAO). Nenhum comportamento novo de billing, só reuso do que já existe.
--
-- Sem eixo: assistente responde pergunta sobre agenda/clientes/caixa/orçamento/estoque —
-- nenhum dos quatro eixos de negócio o exclui.
insert into modules (key, label, eixo, sempre_ligado, ordem) values
  ('assistant', 'Assistente', null, false, 17);
