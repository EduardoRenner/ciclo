-- docs/101 §15: o `/api/health` acusa (amarelo) escritório do pacote Advocacia com membro ativo sem segundo
-- fator verificado há mais de N dias. O pacote exige aal2 em toda tela (0102); membro sem fator não entra,
-- e o escritório costuma descobrir no dia do prazo.
--
-- `auth.mfa_factors` não passa pela PostgREST, então a leitura é uma função definer que devolve só
-- contagem por tenant (nenhum e-mail, nenhum id de usuário). Executável apenas pela `service_role`: é o
-- cliente do health (`withNovoTenant`), e nenhum usuário precisa disso.
create or replace function public.legal_membros_sem_segundo_fator(p_dias int default 7)
returns table (tenant_id uuid, sem_fator int)
language sql stable security definer set search_path = public, auth as $$
  select m.tenant_id, count(*)::int
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  join public.professions p on p.id = t.profession_id
  where p.pacote = 'advocacia'
    and m.active
    and m.created_at < now() - make_interval(days => greatest(p_dias, 0))
    and not exists (select 1 from auth.mfa_factors f where f.user_id = m.user_id and f.status = 'verified')
  group by m.tenant_id
$$;

revoke all on function public.legal_membros_sem_segundo_fator(int) from public, anon, authenticated;
grant execute on function public.legal_membros_sem_segundo_fator(int) to service_role;
