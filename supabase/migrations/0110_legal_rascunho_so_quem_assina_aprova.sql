-- docs/101 §3.4: o que o estágio gera nasce em RASCUNHO e só a direção ou a advocacia tira de lá.
-- Sem esta trava, a política de update de `legal_checklist_items` (quem enxerga o caso, edita) deixava
-- o próprio estágio aprovar o que gerou, e o rascunho virava formalidade.
-- Código próprio (LGL01), e não 42501: o 42501 é o mesmo da violação de RLS, e o servidor precisa
-- distinguir "a regra do rascunho recusou" de "a política recusou" para dar a frase certa.
create or replace function public.legal_rascunho_so_quem_assina_aprova()
returns trigger language plpgsql set search_path = public as $$
declare
  v_estagio boolean;
begin
  if old.status = 'rascunho' and new.status not in ('rascunho', 'cancelado') and current_user = 'authenticated' then
    select coalesce(p.legal_role = 'estagio', false) into v_estagio
      from public.professionals p where p.tenant_id = new.tenant_id and p.user_id = auth.uid() limit 1;
    if coalesce(v_estagio, false) then
      raise exception 'Quem é de estágio não aprova pendência em rascunho: peça à advocacia ou à direção.' using errcode = 'LGL01';
    end if;
  end if;
  return new;
end $$;

create trigger legal_checklist_items_rascunho before update on public.legal_checklist_items
  for each row execute function public.legal_rascunho_so_quem_assina_aprova();
