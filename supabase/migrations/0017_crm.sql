-- CRM: ficha do cliente com preferências, e biblioteca de mensagens prontas.
--
-- `clients` já guardava o que o NEGÓCIO mede (ltv_cents, visits_count, no_show_count) mas nada
-- do que a PESSOA que atende precisa lembrar na hora — e é justamente isso que faz o cliente
-- voltar. Numa barbearia: número da máquina, como faz a barba, se tem redemoinho, alergia a
-- produto. Cada vertical pergunta coisas diferentes, então é `jsonb` livre e não coluna fixa:
-- o formulário decide os campos por vertical, o banco só guarda.
alter table clients add column if not exists preferences jsonb not null default '{}'::jsonb;

-- Mensagens prontas por tenant. A dor: a profissional digita a mesma coisa no WhatsApp o dia
-- inteiro. `body` aceita `{{nome}}`, `{{servico}}`, `{{data}}`, `{{hora}}`, `{{valor}}` e
-- `{{negocio}}`, trocados na hora do envio.
--
-- Tabela por tenant (não catálogo global) porque o texto é a VOZ do negócio — a graça é o dono
-- reescrever do jeito dele. O seed só dá o ponto de partida.
create table if not exists message_templates (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  slug        text not null,
  title       text not null,
  body        text not null,
  active      boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, slug)
);

alter table message_templates enable row level security;
alter table message_templates force row level security;

create policy message_templates_tenant_all on message_templates for all
  using (has_tenant(tenant_id))
  with check (has_tenant(tenant_id));

create index if not exists message_templates_tenant_idx on message_templates (tenant_id, position);
