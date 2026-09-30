-- =====================================================================
-- CICLO · serviço canônico (migration 0097) — docs/84 §2.3
--
-- Cada salão escreve o mesmo serviço de um jeito ("Corte masc.", "Corte degradê", "Social"). Para
-- o agregado anonimizado (ritmo mediano, preço, falta por serviço) comparar negócios, precisa saber
-- de QUAL item do catálogo cada serviço nasceu — e esse vínculo não pode morar no nome, que o dono
-- renomeia quando quiser.
--
-- ## A chave
--
-- `services.canonical_key` guarda a origem, em texto, porque os catálogos são dois:
--   · `pack:<vertical>:<nome no pack>` — `vertical_packs` (as 8 verticais legadas), que não tem id
--     por item; o nome dentro do pack é o identificador estável do item.
--   · `prof:<profession_services.id>` — o catálogo novo das profissões.
-- Serviço criado à mão pelo dono fica NULL: não tem origem, e inventar uma seria pior que ficar
-- de fora do agregado.
--
-- ## Renomear não quebra
--
-- A chave é gravada uma vez, na criação, e nenhuma rota de edição a recebe (o esquema Zod de
-- serviço não tem o campo). Renomear "Corte masculino" para "Corte do Zé" mantém a origem.
--
-- ## Backfill
--
-- Só liga serviço que AINDA tem o nome do catálogo — se o dono já renomeou, não há como saber a
-- origem sem chutar, e fica NULL. Usa a mesma regra de `executarOnboarding` para decidir o
-- catálogo: as 8 verticais legadas vieram de `vertical_packs`; as outras, de `profession_services`.
--
-- ## Deploy
--
-- Aditiva e anulável: pode (e deve) ir para produção ANTES do código. Código velho não escreve a
-- coluna e segue funcionando.
-- =====================================================================

alter table services add column if not exists canonical_key text;

create index if not exists services_canonical_key_idx
  on services (canonical_key) where canonical_key is not null and deleted_at is null;

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
                            deposit_bps, requires_anamnesis, buffer_after_min, canonical_key)
      values (p_tenant, item->>'name', (item->>'duration_min')::int, (item->>'price_cents')::bigint,
              -- "sem ciclo" (0) vira o padrão da coluna, não 1 (0063).
              case when coalesce((item->>'cycle_days')::int, 0) < 1 then 21
                   else (item->>'cycle_days')::int end,
              (item->>'deposit_bps')::int,
              (item->>'requires_anamnesis')::boolean, coalesce((item->>'buffer_after_min')::int, 0),
              'pack:' || p_vertical::text || ':' || (item->>'name'))
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

  -- expediente padrão: seg-sex 9h-19h, sáb 9h-14h. Roda mesmo sem pack.
  insert into business_hours (tenant_id, weekday, opens_at, closes_at)
  select p_tenant, d, '09:00'::time, case when d = 6 then '14:00'::time else '19:00'::time end
  from generate_series(1,6) d
  on conflict do nothing;
end $$;

revoke all on function public.apply_vertical_pack(uuid, vertical_pack) from public, anon, authenticated;
grant execute on function public.apply_vertical_pack(uuid, vertical_pack) to service_role;

create or replace function public.apply_profession_pack(p_tenant uuid, p_profession_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  svc record;
begin
  for svc in select * from profession_services where profession_id = p_profession_id loop
    insert into services (tenant_id, name, duration_min, price_cents, cycle_days, canonical_key)
    values (p_tenant, svc.nome, svc.duracao_min, svc.preco_sugerido_cents, coalesce(svc.ciclo_dias, 21),
            'prof:' || svc.id::text)
    on conflict do nothing;
  end loop;

  insert into business_hours (tenant_id, weekday, opens_at, closes_at)
  select p_tenant, d, '09:00'::time, case when d = 6 then '14:00'::time else '19:00'::time end
  from generate_series(1, 6) d
  on conflict do nothing;
end $$;

revoke all on function public.apply_profession_pack(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_profession_pack(uuid, uuid) to service_role;

-- Backfill: verticais legadas → vertical_packs, pelo nome ainda intacto.
update services s
set canonical_key = 'pack:' || t.vertical::text || ':' || s.name
from tenants t, vertical_packs vp
where s.tenant_id = t.id
  and s.canonical_key is null
  and vp.vertical = t.vertical
  and t.vertical in ('barber', 'nails', 'lashes', 'brows', 'waxing', 'aesthetics', 'tattoo', 'hair')
  and exists (select 1 from jsonb_array_elements(vp.services) e where e->>'name' = s.name);

-- Backfill: as outras profissões → profession_services, pelo nome ainda intacto. Nome repetido
-- dentro do catálogo da mesma profissão não liga nada (ambíguo = não chuta).
update services s
set canonical_key = 'prof:' || ps.id::text
from tenants t, profession_services ps
where s.tenant_id = t.id
  and s.canonical_key is null
  and t.profession_id is not null
  and t.vertical not in ('barber', 'nails', 'lashes', 'brows', 'waxing', 'aesthetics', 'tattoo', 'hair')
  and ps.profession_id = t.profession_id
  and ps.nome = s.name
  and (select count(*) from profession_services d where d.profession_id = t.profession_id and d.nome = s.name) = 1;
