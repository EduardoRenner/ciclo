-- docs/110 L1 · login por número.
--
-- 1. O gatilho de perfil quebrava quem entra pelo telefone.
--    `profiles.full_name` é not null e a reserva era o e-mail. Quem nasce pelo login por número
--    não tem e-mail, e o `insert` falhava com o código já enviado: a pessoa digitava o código
--    certo e a conta não existia. A reserva agora é o telefone, que o Auth sempre tem nesse caso.
--    O telefone do perfil também passa a vir do próprio Auth quando o metadado não traz:
--    `auth.users.phone` é gravado sem o "+" ("5511999990001").
--
-- 2. `telefone_em_outra_conta()`: depois do código certo, diz se o número que a pessoa acabou de
--    provar que é dela já está em OUTRA conta, a de e-mail que ela criou antes. Sem isso o login
--    por número criava uma conta nova e vazia, e a dona via o painel sem o salão dela.
--    Sem parâmetro de propósito: só responde sobre o número de quem chama (`auth.uid()`), então não
--    serve para descobrir se um número qualquer tem conta.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  telefone text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    case when nullif(trim(new.phone), '') is not null then '+' || ltrim(trim(new.phone), '+') end
  );
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email, telefone),
    new.email,
    telefone
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;

create or replace function public.telefone_em_outra_conta()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles outro
    join auth.users eu on eu.id = auth.uid()
    where eu.phone is not null
      and outro.id <> eu.id
      and outro.email is not null
      and outro.phone = '+' || ltrim(eu.phone, '+')
  );
$$;

revoke execute on function public.telefone_em_outra_conta() from anon, public;
grant execute on function public.telefone_em_outra_conta() to authenticated;
