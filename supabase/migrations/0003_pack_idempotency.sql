-- =====================================================================
-- CICLO · torna apply_vertical_pack() idempotente de verdade (migration 0003)
--
-- A 0002 promete no cabeçalho que rodar o pack duas vezes não duplica, mas
-- os `on conflict do nothing` não tinham índice único para morder: a segunda
-- execução dobrava serviços, produtos e expediente (verificado: 6→12 serviços,
-- 7→14 produtos). O onboarding (TICKET-015) chama essa função, e uma tentativa
-- repetida após falha deixaria o catálogo duplicado.
-- =====================================================================

create unique index if not exists services_tenant_name_uniq
  on services (tenant_id, name)
  where deleted_at is null;

create unique index if not exists products_tenant_name_uniq
  on products (tenant_id, name)
  where deleted_at is null;

-- professional_id é nulo no expediente padrão do tenant, então o índice precisa
-- tratar nulos como iguais para deduplicar.
create unique index if not exists business_hours_slot_uniq
  on business_hours (tenant_id, professional_id, weekday, opens_at)
  nulls not distinct;
