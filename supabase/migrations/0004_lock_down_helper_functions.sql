-- =====================================================================
-- CICLO · fecha as funções de apoio expostas na API REST (migration 0004)
--
-- apply_vertical_pack() é SECURITY DEFINER e escreve em services, products,
-- service_products e business_hours de um tenant informado por parâmetro.
-- Como o PostgREST expõe toda função do schema public em /rest/v1/rpc/, o
-- papel `anon` podia chamá-la com o uuid de qualquer tenant e escrever lá
-- dentro sem passar pela RLS. Ela só deve ser chamada pelo servidor, no
-- onboarding (TICKET-015).
--
-- has_tenant/tenant_role/my_professional_id/can_see_appointment continuam
-- executáveis: as políticas de RLS avaliam essas funções com os privilégios
-- de quem faz a consulta, então revogar o EXECUTE quebraria todas elas. São
-- seguras porque só respondem sobre o próprio auth.uid().
-- =====================================================================

revoke all on function public.apply_vertical_pack(uuid, vertical_pack) from public, anon, authenticated;

-- contexto de tenant é ferramenta de worker (withTenant), não de cliente
revoke all on function public.set_tenant_context(uuid)  from public, anon, authenticated;
revoke all on function public.clear_tenant_context()    from public, anon, authenticated;

-- search_path fixo: sem isso a função resolve nomes pelo search_path de quem chama
alter function public.set_tenant_context(uuid)  set search_path = public;
alter function public.clear_tenant_context()    set search_path = public;
alter function public.touch_updated_at()        set search_path = public;
