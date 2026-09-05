-- CICLO · `cycle_days: 0` no pack virava "volte amanhã", e isso corrompia o Motor de Ciclo
--
-- ## O defeito, medido
--
-- Os packs de `vertical_packs` marcam com `cycle_days: 0` os serviços que NÃO têm retorno
-- natural: "Orçamento e consulta", "Avaliação inicial", "Remoção", "Penteado", "Tatuagem
-- pequena/média", "Retoque". São 8 dos 51 serviços semeados (0002 e 0057).
--
-- A coluna `services.cycle_days` tem `check (cycle_days between 1 and 365)`, então o 0 não cabe.
-- A `0008` resolveu com `greatest((item->>'cycle_days')::int, 1)` — o que impede o erro de
-- constraint e, sem querer, afirma uma coisa que ninguém quis dizer: **ciclo de UM DIA**.
--
-- O que 1 dia faz no `computeCycle` (medido, não estimado — `defaultCycleDays: 1`, um único
-- atendimento no histórico):
--
--   |  2 dias depois  |  `late`     |
--   | 14 dias depois  |  `at_risk`  |
--   | 35 dias depois  |  `lost`     |
--
-- Ou seja: quarenta e oito horas depois da tatuagem a cliente já aparece em "Chamar de volta", e
-- em cinco semanas o produto a dá por perdida. Numa vertical inteira (tattoo, hair) isso não é um
-- caso de borda — é a base de clientes toda, permanentemente na lista de recuperação, inflando o
-- "R$ X para recuperar" que é justamente o número que sustenta o preço do produto.
--
-- E não se corrige sozinho com o tempo: `computeCycle` descarta os intervalos maiores que
-- `3 * defaultCycleDays` ao aprender o ciclo pessoal. Com padrão 1, isso é 3 dias — todo intervalo
-- real de uma tatuagem cai fora do filtro, o ciclo pessoal nunca sai do padrão, e o erro é
-- permanente por construção.
--
-- ## O conserto
--
-- `< 1` passa a virar **21**, que é o `default` que a própria coluna escolheu para "não sei o
-- ciclo" (0001). Com 21 o mesmo cliente fica `on_track` por duas semanas e só chega a `at_risk`
-- em cinco — cadência plausível de recuperação em vez de alarme diário. E o filtro de aprendizado
-- passa a aceitar intervalos de até 63 dias, então o ciclo pessoal volta a poder ser aprendido.
--
-- Não é a modelagem ideal: o ideal seria `services.cycle_days` aceitar "sem ciclo" (nulo) e o
-- Motor pular esses serviços. Isso muda coluna, tipo gerado e cinco leitores, e fica registrado
-- como alvo — mas trocar 1 por 21 tira o produto de "erra alto todo dia" e não exige nada disso.
--
-- ## Dependência de deploy, dita em voz alta (0062)
--
-- Migration neste projeto NÃO sobe por deploy automático. Enquanto esta não for aplicada, os
-- tenants de tattoo/hair continuam com `cycle_days = 1`. O `/api/health` da 0062 acusa o atraso.

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
              -- "sem ciclo" (0) vira o padrão da coluna, não 1. Ver o cabeçalho: 1 é uma
              -- afirmação ("volte amanhã"), 21 é a ausência de afirmação.
              case when coalesce((item->>'cycle_days')::int, 0) < 1 then 21
                   else (item->>'cycle_days')::int end,
              (item->>'deposit_bps')::int,
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

-- A regra da 0004 continua valendo.
revoke all on function public.apply_vertical_pack(uuid, vertical_pack) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reparo do que já nasceu errado.
--
-- Alvo estreito de propósito, três condições ao mesmo tempo:
--   1. o serviço está HOJE com `cycle_days = 1`;
--   2. o NOME dele bate com uma entrada de pack;
--   3. aquela entrada de pack foi semeada com `cycle_days` menor que 1.
--
-- Quem renomeou o serviço não é tocado (a condição 2 falha) — conservador de propósito: é melhor
-- deixar de consertar um caso do que reescrever a configuração de alguém que decidiu por conta.
-- E `cycle_days = 1` não é configuração que alguém escolha à mão neste ramo: é o rastro do
-- `greatest(...,1)`.
--
-- `client_cycles` não é tocado aqui: o job `recompute-cycles` roda diariamente e recalcula o
-- estado a partir de `services.cycle_days`. O estado errado se cura sozinho na primeira passada
-- depois desta migration.
update services s
   set cycle_days = 21
 where s.cycle_days = 1
   and exists (
     select 1
       from vertical_packs p
       cross join lateral jsonb_array_elements(p.services) as e(item)
      where e.item->>'name' = s.name
        and coalesce((e.item->>'cycle_days')::int, 0) < 1
   );
