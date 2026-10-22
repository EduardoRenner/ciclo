-- docs/119 · código de acesso pelo WhatsApp (Twilio Verify) só para número já cadastrado.
--
-- `numero_tem_cadastro(telefone, hash)`: o servidor pergunta, ANTES de pedir o código ao Auth, se o
-- número é de alguém que já existe no CICLO:
--   * conta do Auth com esse telefone (profissional que se cadastrou com número e senha);
--   * perfil com esse telefone (conta de e-mail que informou o WhatsApp no cadastro);
--   * cliente de algum negócio com o mesmo `phone_hash`, que não foi apagada nem anonimizada.
--
-- Responde se um número QUALQUER tem cadastro, então é exatamente o que não pode vazar: só a
-- `service_role` executa (rota de pedir código, por `with-tenant.ts`). `anon` e `authenticated`
-- ficam sem execute, e a rota responde igual exista ou não.
--
-- O hash vem pronto do servidor porque o sal (`PHONE_HASH_SALT`) mora na variável de ambiente,
-- não no banco. Aditiva: sobe antes do deploy do código.

create or replace function public.numero_tem_cadastro(p_telefone text, p_phone_hash text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from auth.users u
      where u.phone = ltrim(p_telefone, '+')
        and u.deleted_at is null
    )
    or exists (
      select 1 from public.profiles p
      where p.phone = '+' || ltrim(p_telefone, '+')
    )
    or (
      p_phone_hash is not null
      and exists (
        select 1 from public.clients c
        where c.phone_hash = p_phone_hash
          and c.deleted_at is null
          and c.anonymized_at is null
      )
    );
$$;

revoke execute on function public.numero_tem_cadastro(text, text) from anon, authenticated, public;
grant execute on function public.numero_tem_cadastro(text, text) to service_role;
