-- APR-029 (achados B-00a, E-01): quem pode ver cada comanda e cada item, calculado UMA vez por consulta.
--
-- `tickets_select` e `ticket_items_select` chamavam `can_see_ticket(tenant_id, professional_id)`, que
-- delega para `can_see_appointment`: o mesmo custo por linha da APR-028. Medido no banco local
-- (`docs/98-aprimoramento/medidas`): somar 10 mil itens levava 1,8 s como dono e 2,6 s como
-- profissional. Caixa, Mês e Comissão somam itens; a conta cresce com o histórico.
--
-- Mesma técnica e mesmas funções da 0123 (`my_tenant_ids`, `my_full_view_tenant_ids`,
-- `my_professional_keys`), com a mesma regra ramo por ramo — inclusive o par negócio:profissional, e
-- não o id solto. Só as políticas de LEITURA mudam: insert, update e delete destas tabelas são
-- `has_tenant` puro desde a 0073, sem régua de profissional, e ficam como estão.
--
-- Equivalente: sobe junto do deploy, com `test:rls` antes e depois
-- (`tests/rls/comanda-por-papel.test.ts`, escrito e visto verde contra a política antiga, e
-- `ticket-por-profissional.test.ts`, da 0073). Reversão no fim do arquivo.

drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select using (
  tenant_id = any ((select public.my_tenant_ids())::uuid[])
  and (
    tenant_id = any ((select public.my_full_view_tenant_ids())::uuid[])
    or (tenant_id::text || ':' || professional_id::text) = any ((select public.my_professional_keys())::text[])
  )
);

drop policy if exists ticket_items_select on public.ticket_items;
create policy ticket_items_select on public.ticket_items for select using (
  tenant_id = any ((select public.my_tenant_ids())::uuid[])
  and (
    tenant_id = any ((select public.my_full_view_tenant_ids())::uuid[])
    or (tenant_id::text || ':' || professional_id::text) = any ((select public.my_professional_keys())::text[])
  )
);

-- Reversão (compensatória), se for preciso voltar:
--
--   drop policy if exists tickets_select on public.tickets;
--   create policy tickets_select on public.tickets for select
--     using (public.has_tenant(tenant_id) and public.can_see_ticket(tenant_id, professional_id));
--   drop policy if exists ticket_items_select on public.ticket_items;
--   create policy ticket_items_select on public.ticket_items for select
--     using (public.has_tenant(tenant_id) and public.can_see_ticket(tenant_id, professional_id));
