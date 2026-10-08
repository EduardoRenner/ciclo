-- docs/101 T4: quem é de estágio cria prazo, mas não confirma (0109 já tira a confirmação no INSERT). A
-- recusa no UPDATE morava só no serviço (`server/advocacia/prazos.ts`); pela API do Supabase, com o token
-- da própria pessoa, um UPDATE direto em `confirmed_by` passaria. A trava vai para o banco, mesmo desenho
-- da 0110 (rascunho), com código próprio para o servidor traduzir sem confundir com a RLS (42501).
create or replace function public.legal_prazo_confirmacao_so_advocacia()
returns trigger language plpgsql set search_path = public as $$
declare
  v_estagio boolean;
begin
  if old.confirmed_by is null and new.confirmed_by is not null and current_user = 'authenticated' then
    select coalesce(p.legal_role = 'estagio', false) into v_estagio
      from public.professionals p where p.tenant_id = new.tenant_id and p.user_id = auth.uid() limit 1;
    if coalesce(v_estagio, false) then
      raise exception 'Quem é de estágio não confirma prazo: peça à advocacia.' using errcode = 'LGL01';
    end if;
  end if;
  return new;
end $$;

create trigger legal_deadlines_confirmacao before update on public.legal_deadlines
  for each row execute function public.legal_prazo_confirmacao_so_advocacia();
