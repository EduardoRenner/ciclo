-- docs/112 EXP-S06 · catálogo pronto de salão revisado (`docs/112-experiencia/04-salao.md` §4).
--
-- O que estava errado: faltava o que mais se vende (pé e mão, alongamento em gel, manutenção de fio a
-- fio, meia perna), corte masculino era o 2º do cabelo, e `apply_vertical_pack` gravava tudo com
-- `position = 0`: a página pública ordena só por `position` e abria por "Aplicação volume russo",
-- com "Remoção" para a cliente marcar.
--
-- Só ACRESCENTA e reordena. `canonical_key` é `pack:<vertical>:<nome>` (0097) e liga os serviços das
-- contas antigas ao agregado e ao serviço de volta: renomear um item quebraria esse vínculo sem erro.
-- Vale para conta nova; conta existente não muda. Pode subir antes do código.

-- 1. A função grava a ordem do pacote em `position`.
create or replace function public.apply_vertical_pack(p_tenant uuid, p_vertical vertical_pack)
returns void language plpgsql security definer set search_path = public as $$
declare
  pk record; item jsonb; ordem bigint;
  svc_ids jsonb := '{}'::jsonb; prod_ids jsonb := '{}'::jsonb;
  new_id uuid;
begin
  select * into pk from vertical_packs where vertical = p_vertical;

  if found then
    -- serviços, na ordem do pacote: o serviço de volta primeiro, o sem retorno por último.
    for item, ordem in select e.value, e.ordinality from jsonb_array_elements(pk.services) with ordinality as e loop
      insert into services (tenant_id, name, duration_min, price_cents, cycle_days,
                            deposit_bps, requires_anamnesis, buffer_after_min, canonical_key, position)
      values (p_tenant, item->>'name', (item->>'duration_min')::int, (item->>'price_cents')::bigint,
              -- "sem ciclo" (0) vira o padrão da coluna, não 1 (0063).
              case when coalesce((item->>'cycle_days')::int, 0) < 1 then 21
                   else (item->>'cycle_days')::int end,
              (item->>'deposit_bps')::int,
              (item->>'requires_anamnesis')::boolean, coalesce((item->>'buffer_after_min')::int, 0),
              'pack:' || p_vertical::text || ':' || (item->>'name'),
              ordem - 1)
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

-- 2. Os pacotes: itens novos, ajustes do §4 e a ordem. Item que não está em `ordem` iria para o fim.
with ajuste(vertical, ordem, mudar, novos) as (values
  ('nails'::vertical_pack,
   array['Pé e mão', 'Manicure simples', 'Pedicure', 'Esmaltação em gel', 'Manutenção de alongamento',
         'Alongamento em gel', 'Alongamento em fibra', 'Banho de gel', 'Blindagem', 'Remoção'],
   '{"Manicure simples": {"cycle_days": 14}, "Esmaltação em gel": {"duration_min": 60},
     "Manutenção de alongamento": {"cycle_days": 21}}'::jsonb,
   '[{"name": "Pé e mão", "price_cents": 7500, "duration_min": 90, "cycle_days": 14, "deposit_bps": 0,
      "buffer_after_min": 10, "requires_anamnesis": false},
     {"name": "Alongamento em gel", "price_cents": 17000, "duration_min": 150, "cycle_days": 21, "deposit_bps": 3000,
      "buffer_after_min": 10, "requires_anamnesis": true},
     {"name": "Blindagem", "price_cents": 8000, "duration_min": 60, "cycle_days": 20, "deposit_bps": 0,
      "buffer_after_min": 5, "requires_anamnesis": false}]'::jsonb),
  ('lashes'::vertical_pack,
   array['Manutenção volume russo', 'Manutenção fio a fio', 'Aplicação clássica', 'Aplicação híbrida',
         'Aplicação volume russo', 'Lash lifting + botox', 'Remoção'],
   '{}'::jsonb,
   '[{"name": "Manutenção fio a fio", "price_cents": 10000, "duration_min": 75, "cycle_days": 21, "deposit_bps": 3000,
      "buffer_after_min": 10, "requires_anamnesis": false}]'::jsonb),
  ('brows'::vertical_pack,
   array['Design simples', 'Design com henna', 'Brow lamination', 'Micropigmentação', 'Retoque de micro'],
   '{"Brow lamination": {"price_cents": 11000}}'::jsonb,
   '[]'::jsonb),
  ('hair'::vertical_pack,
   array['Corte feminino', 'Escova', 'Coloração / retoque de raiz', 'Hidratação', 'Mechas / luzes',
         'Progressiva', 'Corte masculino', 'Penteado'],
   '{}'::jsonb,
   '[]'::jsonb),
  ('waxing'::vertical_pack,
   array['Perna inteira', 'Meia perna', 'Virilha completa', 'Axila', 'Buço', 'Combo perna + virilha + axila'],
   '{"Perna inteira": {"price_cents": 9000}}'::jsonb,
   '[{"name": "Meia perna", "price_cents": 5000, "duration_min": 30, "cycle_days": 28, "deposit_bps": 0,
      "buffer_after_min": 10, "requires_anamnesis": true}]'::jsonb)
)
update vertical_packs v
   set services = (
     select jsonb_agg(s.item || coalesce(a.mudar -> (s.item->>'name'), '{}'::jsonb)
                      order by array_position(a.ordem, s.item->>'name') nulls last, s.ord)
       from jsonb_array_elements(v.services || a.novos) with ordinality as s(item, ord)
   )
  from ajuste a
 where v.vertical = a.vertical;
