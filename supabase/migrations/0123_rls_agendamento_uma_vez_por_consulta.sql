-- APR-028 (achados B-00a, E-01, G-48): quem pode ver cada agendamento, calculado UMA vez por consulta.
--
-- `appointments_select`/`_update` chamavam `can_see_appointment(tenant_id, professional_id)`: função
-- `security definer` com argumento de COLUNA, que o Postgres não transforma em initplan — roda uma
-- vez por linha lida, e por dentro chama `has_tenant`, `tenant_role`, lê `tenants.settings` e
-- `my_professional_id`. Medido no banco local (`docs/98-aprimoramento/medidas`): contar 10 mil
-- agendamentos levava 1,3 s como dono e 2,2 s como profissional. Cresce com o histórico, não com o
-- uso do dia: a Hoje para de abrir em algum ponto entre 18 e 80 mil agendamentos.
--
-- A troca: três funções SEM argumento, chamadas como `(select …)`, que o planejador avalia uma vez
-- e compara como conjunto. A regra é a MESMA de `can_see_appointment`, ramo por ramo:
--   · não é membro ativo do negócio            → não vê              (`my_tenant_ids`)
--   · dono, gerente, recepção, financeiro      → vê tudo             (`my_full_view_tenant_ids`)
--   · `restrict_professional_view` desligado   → vê tudo             (idem)
--   · senão                                    → só o profissional dela NAQUELE negócio
--                                                                    (`my_professional_keys`)
-- O último ramo compara o PAR negócio:profissional, e não só o id: a FK de `professional_id` não
-- amarra o tenant, e um "meus profissionais" solto deixaria a pessoa que é profissional em dois
-- negócios ver, em B, um agendamento que aponta para o id dela em A. Há teste para esse caso.
--
-- Uma diferença, documentada: `my_professional_id` tem `limit 1` e escolhe UM profissional quando a
-- pessoa tem dois cadastros no mesmo negócio (não há trava contra isso); aqui ela vê os dois. Hoje
-- não existe esse caso no banco local, e ver as duas agendas próprias é o comportamento esperado.
--
-- `appointment_series`, `quotes` e `tickets`/`ticket_items` continuam com a função por linha:
-- `tickets` e `ticket_items` são a APR-029; as outras duas são pequenas.
--
-- Equivalente: troca política por política com a mesma semântica. Sobe junto do deploy, com
-- `test:rls` antes e depois (`tests/rls/agendamento-por-papel.test.ts`, escrito e visto verde contra a
-- política antiga). A reversão está no fim deste arquivo.

create or replace function public.my_tenant_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(m.tenant_id), '{}')
  from public.memberships m
  where m.user_id = auth.uid() and m.active;
$$;

create or replace function public.my_full_view_tenant_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(m.tenant_id), '{}')
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = auth.uid()
    and m.active
    and (
      m.role in ('owner', 'manager', 'reception', 'finance')
      or coalesce((t.settings->>'restrict_professional_view')::boolean, false) = false
    );
$$;

-- `tenant_id:professional_id` de cada cadastro de profissional da pessoa (ver o cabeçalho).
create or replace function public.my_professional_keys()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(p.tenant_id::text || ':' || p.id::text), '{}')
  from public.professionals p
  where p.user_id = auth.uid() and p.deleted_at is null;
$$;

comment on function public.my_tenant_ids() is 'APR-028: negócios em que auth.uid() é membro ativo, para políticas em initplan.';
comment on function public.my_full_view_tenant_ids() is 'APR-028: negócios em que auth.uid() vê todos os agendamentos (papel de gestão ou visão aberta).';
comment on function public.my_professional_keys() is 'APR-028: pares tenant_id:professional_id dos cadastros de profissional de auth.uid().';

-- Mesmo acesso das funções que substituem (`has_tenant`, `can_see_appointment`): a política é
-- avaliada para qualquer papel que chegue à tabela.
revoke all on function public.my_tenant_ids() from public;
revoke all on function public.my_full_view_tenant_ids() from public;
revoke all on function public.my_professional_keys() from public;
grant execute on function public.my_tenant_ids() to anon, authenticated, service_role;
grant execute on function public.my_full_view_tenant_ids() to anon, authenticated, service_role;
grant execute on function public.my_professional_keys() to anon, authenticated, service_role;

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments for select using (
  tenant_id = any ((select public.my_tenant_ids())::uuid[])
  and (
    tenant_id = any ((select public.my_full_view_tenant_ids())::uuid[])
    or (tenant_id::text || ':' || professional_id::text) = any ((select public.my_professional_keys())::text[])
  )
);

drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments for update
  using (
    tenant_id = any ((select public.my_tenant_ids())::uuid[])
    and (
      tenant_id = any ((select public.my_full_view_tenant_ids())::uuid[])
      or (tenant_id::text || ':' || professional_id::text) = any ((select public.my_professional_keys())::text[])
    )
  )
  with check (tenant_id = any ((select public.my_tenant_ids())::uuid[]));

-- Reversão (compensatória), se for preciso voltar:
--
--   drop policy if exists appointments_select on public.appointments;
--   create policy appointments_select on public.appointments for select
--     using (public.has_tenant(tenant_id) and public.can_see_appointment(tenant_id, professional_id));
--   drop policy if exists appointments_update on public.appointments;
--   create policy appointments_update on public.appointments for update
--     using (public.has_tenant(tenant_id) and public.can_see_appointment(tenant_id, professional_id))
--     with check (public.has_tenant(tenant_id));
--
-- As três funções podem ficar: nada além destas políticas as usa.
