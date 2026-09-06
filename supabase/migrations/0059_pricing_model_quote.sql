-- `services.pricing_model` aceitava só 'fixed', 'hourly', 'visit_hourly' e 'daily' (0029), e os
-- QUATRO exigem um número. Quem não tem preço de tabela -- eletricista, faxineira, quem faz obra --
-- só conseguia cadastrar mentindo um valor.
--
-- 'quote' e o quinto: o servico existe no catalogo, aparece na vitrine e diz "Sob orcamento".
-- O eixo e o SERVICO e nao a conta de proposito: negocio hibrido e o caso comum (a manicure tem
-- tabela e orca alongamento), e um modo binario na conta obrigaria a pessoa a mentir num dos lados.
-- Ver docs/40-MODOS-DE-COBRANCA-PLANO.md.
alter table services drop constraint if exists services_pricing_model_check;

alter table services
  add constraint services_pricing_model_check
  check (pricing_model in ('fixed', 'hourly', 'visit_hourly', 'daily', 'quote'));

comment on column services.price_cents is
  'Significado depende de pricing_model: fixed = preço total; hourly = preço por hora; visit_hourly = taxa de visita/chamada (hourly_rate_cents é o valor da hora); daily = diária inteira; quote = ignorado, o valor nasce no orçamento.';
