-- TICKET-017 · a FAQ C36 descreve o convite por link ("POST /api/v1/memberships/
-- invite gera token de 7 dias... ao aceitar, cria profile + membership +
-- professional"), mas nenhuma tabela do schema travado guarda esse token — é
-- o mesmo tipo de lacuna que a 0006 fechou para `profiles`.
--
-- O token cru nunca é gravado, só o hash (mesmo cuidado de senha): um vazamento
-- de linha da tabela não vira convite utilizável.

create table invites (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  email         citext not null,
  role          user_role not null,
  display_name  text,                          -- nome sugerido do profissional, se o convite for esse
  token_hash    text not null unique,
  invited_by    uuid not null references profiles(id),
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index on invites (tenant_id, created_at desc);

alter table invites enable row level security;
alter table invites force row level security;

-- Mesma trava de `memberships_write`: só o dono cria vínculo novo no tenant.
-- Aceitar o convite (TICKET-017) passa pelo service_role de propósito — quem
-- aceita ainda não tem membership nenhuma, então `has_tenant()` daria falso
-- para ele mesmo que a política permitisse.
create policy invites_owner_only on invites for all
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) = 'owner')
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) = 'owner');
