-- CICLO · APR-211 (docs/98 E-14): o mês congelado guarda o aluguel (custo fixo rateado) e a gorjeta.
--
-- `monthly_profit` tinha receita, material, taxa, comissão e lucro — e o lucro já vinha com o custo
-- fixo descontado (0072), sem a coluna que diz QUANTO. A conta não fechava pela tabela:
-- revenue − material − fee − commission ≠ profit. Agora fecha: − fixed_cost = profit. A gorjeta vai
-- junto porque entra no "Entrou" e não é receita de serviço; sem ela a receita do mês inflava.
--
-- Migration ADITIVA (colunas novas com default 0): sobe ANTES do código. Meses já congelados ficam
-- com 0 — o congelamento não é refeito (é o combinado do 0072: mês fechado não muda).

alter table public.monthly_profit
  add column if not exists fixed_cost_cents bigint not null default 0,
  add column if not exists tip_cents bigint not null default 0;

comment on column public.monthly_profit.fixed_cost_cents is 'Custo fixo rateado nas comandas do mês (soma de tickets.fixed_cost_cents). APR-211.';
comment on column public.monthly_profit.tip_cents is 'Gorjetas do mês (soma de tickets.tip_cents). Entra no Entrou, não na receita de serviço. APR-211.';
