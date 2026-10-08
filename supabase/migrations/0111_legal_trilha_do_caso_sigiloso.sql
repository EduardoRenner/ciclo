-- docs/101 anexo 04 §4.4: "Caso sigiloso: cada abertura grava trilha". A trilha (`legal_access_log`,
-- 0107) não tem política para ninguém: só o servidor grava. Esta é a porta, e ela só registra o que a
-- pessoa de fato alcança (`legal_can_access_case`), para a trilha não virar um verificador de casos.
--
-- Só o SIGILOSO gera linha: abrir caso comum é rotina, e uma trilha que registra tudo é uma trilha que
-- ninguém lê. O que importa auditar é quem viu o que estava restrito.
create or replace function public.legal_registrar_abertura_do_caso(p_case uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_sigiloso boolean;
begin
  if not public.legal_can_access_case(p_case) then
    return false;
  end if;
  select c.tenant_id, c.sensitivity = 'sigiloso' into v_tenant, v_sigiloso from public.legal_cases c where c.id = p_case;
  if not coalesce(v_sigiloso, false) then
    return false;
  end if;
  insert into public.legal_access_log (tenant_id, user_id, case_id, kind) values (v_tenant, auth.uid(), p_case, 'open_case');
  return true;
end $$;

revoke all on function public.legal_registrar_abertura_do_caso(uuid) from public, anon;
grant execute on function public.legal_registrar_abertura_do_caso(uuid) to authenticated;
