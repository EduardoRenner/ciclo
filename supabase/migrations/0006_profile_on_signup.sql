-- TICKET-009 · o espelho de auth.users precisa nascer sozinho.
--
-- `profiles` é descrito na 0001 como "espelho de auth.users", mas nada o
-- preenchia. Criar a linha pela aplicação não funciona: com confirmação de
-- e-mail ligada, logo depois do signup ainda não existe sessão, então não há
-- `auth.uid()` para a política `profiles_self` autorizar o insert. E se o insert
-- ficasse para o primeiro login, todo código adiante teria de tratar o caso de
-- usuário sem profile.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    -- O cadastro exige nome, mas um usuário criado pelo painel do Supabase não
    -- passa por lá; o e-mail é o rótulo que sempre existe.
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Mesma trava da 0004: função SECURITY DEFINER que escreve não pode ficar
-- chamável pela API. O PostgREST publica toda função de `public` em
-- /rest/v1/rpc/, e esta escreve em profiles.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
