-- TICKET-028 (achado ao testar mensageria com vertical 'hair') · o enum
-- vertical_pack (0001) tem 8 valores, mas vertical_packs (0002) só semeia 6:
-- 'tattoo' e 'hair' não têm pack. apply_vertical_pack() estourava exceção
-- para essas duas, e como o TICKET-015 chama essa função dentro do
-- onboarding, a conta nunca chegava a existir — 500 puro para quem escolhesse
-- uma dessas duas verticais no cadastro.
--
-- Sem catálogo de verdade para tatuagem/cabelo (construir um exigiria
-- conhecimento de negócio que não está em nenhum documento), o mais simples
-- que atende ao critério "onboarding funciona" é deixar a conta nascer com
-- catálogo vazio nessas duas verticais — a pessoa cadastra os serviços à mão
-- (TICKET-016) — em vez de travar o cadastro inteiro.

create or replace function public.apply_vertical_pack(p_tenant uuid, p_vertical vertical_pack)
returns void language plpgsql security definer set search_path = public as $$
declare
  pk record; item jsonb;
  svc_ids jsonb := '{}'::jsonb; prod_ids jsonb := '{}'::jsonb;
  new_id uuid;
begin
  select * into pk from vertical_packs where vertical = p_vertical;

  if found then
    -- serviços
    for item in select * from jsonb_array_elements(pk.services) loop
      insert into services (tenant_id, name, duration_min, price_cents, cycle_days,
                            deposit_bps, requires_anamnesis, buffer_after_min)
      values (p_tenant, item->>'name', (item->>'duration_min')::int, (item->>'price_cents')::bigint,
              greatest((item->>'cycle_days')::int, 1), (item->>'deposit_bps')::int,
              (item->>'requires_anamnesis')::boolean, coalesce((item->>'buffer_after_min')::int, 0))
      on conflict do nothing
      returning id into new_id;
      if new_id is not null then svc_ids := svc_ids || jsonb_build_object(item->>'name', new_id); end if;
    end loop;

    -- produtos
    for item in select * from jsonb_array_elements(pk.products) loop
      insert into products (tenant_id, name, unit, avg_cost_cents, reorder_point)
      values (p_tenant, item->>'name', item->>'unit', (item->>'avg_cost_cents')::bigint,
              (item->>'reorder_point')::numeric)
      on conflict do nothing
      returning id into new_id;
      if new_id is not null then prod_ids := prod_ids || jsonb_build_object(item->>'name', new_id); end if;
    end loop;

    -- ficha de consumo
    for item in select * from jsonb_array_elements(pk.consumption) loop
      if svc_ids ? (item->>'service') and prod_ids ? (item->>'product') then
        insert into service_products (tenant_id, service_id, product_id, qty)
        values (p_tenant, (svc_ids->>(item->>'service'))::uuid,
                (prod_ids->>(item->>'product'))::uuid, (item->>'qty')::numeric)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- expediente padrão: seg-sex 9h-19h, sáb 9h-14h. Roda mesmo sem pack —
  -- expediente não depende de catálogo.
  insert into business_hours (tenant_id, weekday, opens_at, closes_at)
  select p_tenant, d, '09:00'::time, case when d = 6 then '14:00'::time else '19:00'::time end
  from generate_series(1,6) d
  on conflict do nothing;
end $$;

-- A regra da 0004 continua valendo: função SECURITY DEFINER que escreve não
-- pode ficar chamável por anon/authenticated no PostgREST.
revoke all on function public.apply_vertical_pack(uuid, vertical_pack) from public, anon, authenticated;
