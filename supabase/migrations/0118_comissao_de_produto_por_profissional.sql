-- Comissão de PRODUTO por profissional, opcional. Nulo = vale a do negócio
-- (`tenants.settings.product_commission_bps`, padrão 10%). Só adiciona uma coluna: pode subir antes do deploy.
alter table public.professionals
  add column if not exists product_commission_bps int
  check (product_commission_bps is null or product_commission_bps between 0 and 10000);
