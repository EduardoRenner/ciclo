-- CICLO · o SUJEITO do ciclo: quem volta nem sempre é o cliente (docs/106-automotivo AUT-101, EXP-001)
--
-- Na beleza o cliente É quem volta. No pet volta o ANIMAL; na oficina, o CARRO. Um tutor com 2 cães no
-- banho quinzenal vira hoje uma série só, com intervalos de ~7 dias, e a perda de um dos animais fica
-- invisível (medido no C-003: 0% vista por série única, 100% por sujeito).
--
-- Esta migration é só a TABELA (aditiva). As colunas que apontam para ela ficam na 0133, separada de
-- propósito: a guarda `nunca-delete-o-que-e-historico` conta `on delete cascade` por arquivo, e o
-- cascade daqui (sujeito → cliente) não pode dividir arquivo com a tabela de histórico.
-- A troca da chave de `client_cycles` para incluir o sujeito vem em migration própria (equivalente),
-- junto com o código que a usa. Nada aqui é lido pelo código ainda.
--
-- Revisão adversarial (docs/105-ciclo/C-003/02-plano.md):
-- - Chave COMPOSTA `(tenant_id, id)` como alvo: quem apontar para cá (0133) só consegue apontar para um
--   sujeito do MESMO tenant (FK não passa pela RLS; a chave composta exige o tenant igual).
-- - Embed do PostgREST: nenhum select atual embute `subjects`, então nenhum embed fica ambíguo.
-- - Transferência de veículo: `client_id` é atualizável; o histórico fica no sujeito.
-- - LGPD: placa e nome do animal são dado pessoal comum. A eliminação do cliente ANONIMIZA a linha dele
--   (não apaga), então o cascade daqui não dispara nela: `eliminarComServico` anonimiza e inativa os
--   sujeitos (TRATAMENTO_NA_ELIMINACAO.subjects). O cascade só vale para remoção física do cliente.

-- `clients (tenant_id, id)` único: alvo da chave composta. `id` já é único, então isto não muda dado.
create unique index if not exists clients_tenant_id_id_key on clients (tenant_id, id);

create table subjects (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  client_id   uuid not null,
  kind        text not null check (kind in ('animal', 'veiculo')),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  -- Placa normalizada (veículo) ou microchip; nulo quando não há.
  identifier  text check (identifier is null or identifier ~ '^[A-Z0-9-]{3,20}$'),
  attributes  jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  foreign key (tenant_id, client_id) references clients (tenant_id, id) on delete cascade,
  unique (tenant_id, id)
);

-- A mesma placa não é dois carros no mesmo negócio (ativo). Inativo (vendido, morto) libera.
create unique index subjects_identificador_unico on subjects (tenant_id, kind, identifier)
  where identifier is not null and active;
create index subjects_cliente_idx on subjects (tenant_id, client_id);

alter table subjects enable row level security;
alter table subjects force row level security;

create policy subjects_select on subjects for select using (public.has_tenant(tenant_id));
create policy subjects_insert on subjects for insert with check (public.has_tenant(tenant_id));
create policy subjects_update on subjects for update
  using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

-- Nunca apagar: o sujeito que saiu vira `active = false` (regra 11 do CLAUDE.md, histórico não some).
revoke delete on public.subjects from authenticated, anon;

comment on table subjects is
  'AUT-101/EXP-001: quem volta (animal ou veículo) de um cliente. Sem DELETE: saiu = active false. Placa/microchip em identifier, normalizado.';
