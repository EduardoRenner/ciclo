-- P10 (docs/09-PLATAFORMA.md G5, §15): services.price_cents sempre foi um valor fixo — não
-- representa "por hora" (consultor, eletricista), "visita + hora" (eletricista, encanador) nem
-- "diária/meia diária" (faxineira). "Por orçamento" (G6) já fechou em P8 (quotes/quote_items) e
-- "por pacote"/"mensalidade recorrente" já existiam (packages, client_subscriptions) — G5 restava
-- só nesses 3 modelos, que são o que esta migration resolve no CATÁLOGO. A cobrança final de
-- verdade (o que entra no caixa) já é flexível desde sempre via ticket_items/quote_items
-- (qty × preço unitário livre) — não precisa mudar; o que faltava era o catálogo conseguir
-- ANUNCIAR o preço do jeito certo pra cada profissão, não fingir que tudo é preço fechado.

alter table services
  add column pricing_model text not null default 'fixed'
    check (pricing_model in ('fixed', 'hourly', 'visit_hourly', 'daily')),
  -- Só usado quando pricing_model = 'visit_hourly': price_cents vira a taxa de visita/chamada,
  -- e esta coluna é o valor cobrado por hora depois que o profissional chega.
  add column hourly_rate_cents bigint check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  -- Só usado quando pricing_model = 'daily': "meia diária" opcional. `null` = só cobra diária inteira.
  add column half_day_price_cents bigint check (half_day_price_cents is null or half_day_price_cents >= 0),
  add constraint services_visit_hourly_tem_taxa
    check (pricing_model != 'visit_hourly' or hourly_rate_cents is not null);

comment on column services.price_cents is
  'Significado depende de pricing_model: fixed = preço total; hourly = preço por hora; visit_hourly = taxa de visita/chamada (hourly_rate_cents é o valor da hora); daily = diária inteira.';
