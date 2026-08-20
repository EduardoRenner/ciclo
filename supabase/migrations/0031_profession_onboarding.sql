-- P4 (docs/09-PLATAFORMA.md §7/§16 critério 4): achado crítico ao revisar o plano inteiro — o
-- catálogo de 17 profissões (professions/profession_services, P0+P5) nunca foi ligado ao
-- cadastro de verdade. `executarOnboarding()` só aceita `vertical_pack` (as 8 verticais de
-- beleza do enum original); não existe NENHUM jeito, hoje, de uma eletricista ou faxineira se
-- cadastrar. Todo o trabalho de P5 (catálogo profundo), P7 (recorrência), P9 (buffer/mapa) e
-- P10 (preço por hora) fica inacessível pra quem não é dos 8 nichos de beleza originais.
--
-- 'general' é o valor de `vertical_pack` pra tenant cuja profissão não é nenhuma das 8
-- verticais legadas — os poucos lugares que leem `tenant.vertical` hoje (anamnese, cor de
-- destaque da página pública, campos de preferência do cliente) já tratam vertical
-- desconhecida com fallback gracioso (`.maybeSingle()` + `?? padrão`), auditado antes desta
-- migration — não quebra nada existente.
alter type vertical_pack add value 'general';

-- `apply_profession_pack()` é o `apply_vertical_pack()` das 9 profissões novas (docs/09-
-- PLATAFORMA.md §14 item 5 previa esse nome). Deliberadamente NÃO substitui apply_vertical_pack
-- para as 8 verticais legadas — `vertical_packs` tem catálogo rico e testado pra 6 delas
-- (barber/nails/lashes/brows/waxing/aesthetics); `profession_services` só tem dado rico pra
-- barber (P5) e as 9 novas. Trocar todo mundo pra este RPC agora reduziria nail/lashes/etc a
-- catálogo vazio — regressão, não melhoria. A decisão de QUAL RPC chamar é feita em
-- `executarOnboarding()` (aplicação), olhando se a profissão escolhida é uma das 8 legadas.
create or replace function public.apply_profession_pack(p_tenant uuid, p_profession_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  svc record;
begin
  for svc in select * from profession_services where profession_id = p_profession_id loop
    insert into services (tenant_id, name, duration_min, price_cents, cycle_days)
    values (p_tenant, svc.nome, svc.duracao_min, svc.preco_sugerido_cents, coalesce(svc.ciclo_dias, 21))
    on conflict do nothing;
  end loop;

  -- Mesmo expediente padrão de `apply_vertical_pack` (seg-sex 9h-19h, sáb 9h-14h) — roda mesmo
  -- se a profissão não tiver nenhum serviço no catálogo ainda.
  insert into business_hours (tenant_id, weekday, opens_at, closes_at)
  select p_tenant, d, '09:00'::time, case when d = 6 then '14:00'::time else '19:00'::time end
  from generate_series(1, 6) d
  on conflict do nothing;
end $$;

-- Mesma trava da 0004: função SECURITY DEFINER que escreve não pode ficar chamável direto
-- pelo PostgREST.
revoke all on function public.apply_profession_pack(uuid, uuid) from public, anon, authenticated;
