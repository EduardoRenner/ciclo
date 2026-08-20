-- Achado real na verificação estrutural (V1, docs/10-PROXIMOS-PASSOS.md, checklist Gate 4):
-- `public.profiles` nunca teve FK pra `auth.users` — só chave primária. A limpeza de tenants
-- de teste em P−1 (76 tenants removidos via `auth.admin.deleteUser`) apagou as contas de
-- `auth.users`, mas sem FK com `on delete cascade` os `profiles` correspondentes (full_name,
-- email, phone — dado pessoal de verdade) ficaram órfãos: 2340 linhas sem conta nenhuma por
-- trás. Confirmado antes de apagar: nenhuma tabela do produto (memberships, appointments,
-- tickets, quotes, etc.) referencia esses ids — são debris puro da limpeza anterior, não
-- histórico de negócio escondido.
delete from public.profiles p
where not exists (select 1 from auth.users u where u.id = p.id);

-- Trava a causa raiz: sem isso, a próxima limpeza de conta de teste (ou exclusão real de
-- usuário, LGPD "direito ao esquecimento") repete o mesmo vazamento de PII órfã.
alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
