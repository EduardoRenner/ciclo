-- =====================================================================
-- CICLO · TICKET-059 · Catálogo de profissões (P0 de docs/09-PLATAFORMA.md)
--
-- O cabeçalho de 0002_vertical_packs.sql já dizia: "a diferença entre as
-- profissões é CONFIGURAÇÃO, não código". `vertical_pack` era um enum de 8
-- valores, todos de beleza — enum não é catálogo, e `ALTER TYPE ... ADD
-- VALUE` não pode ter o valor novo usado na mesma transação (armadilha já
-- documentada nesta família, no stark-restaurante). Profissão vira dado que
-- o usuário escolhe: linha de tabela, não tipo de banco.
--
-- Escopo desta migration é só a camada de dado — schema, RLS, seed,
-- backfill não destrutivo. Nenhum comportamento de tenant existente muda
-- (docs/09-PLATAFORMA.md §14, critério de aceite 6): `tenants.vertical`
-- continua sendo lido por todo o código até a migração de leitura (P1/P2)
-- acontecer. Vocabulário, módulos e onboarding novo vêm em tickets
-- seguintes — aqui só nasce o catálogo e a ponte.
-- =====================================================================

-- catálogo global (sem tenant_id): leitura para todos, escrita só pelo servidor.
-- Mesmo desenho de vertical_packs — provado, não precisa reinventar.
create table professions (
  id                    uuid primary key default gen_random_uuid(),
  slug                  citext not null unique,
  nome                  text not null,
  grupo                 text not null,               -- beleza | casa | saude | fitness | educacao | pet | eventos | profissional
  sinonimos             text[] not null default '{}', -- "diarista" acha faxina — busca do onboarding (§7)
  -- os 4 eixos de docs/09-PLATAFORMA.md §4
  onde                  text not null check (onde in ('no_local','vai_ate','remoto','hibrido')),
  cobranca              text not null check (cobranca in ('fixo','hora','visita_hora','diaria','orcamento','pacote','recorrente')),
  inicio                text not null check (inicio in ('direto','solicitacao','orcamento_antes')),
  ritmo                 text not null check (ritmo in ('avulso','recorrente','sazonal','sob_demanda')),
  -- configuração — consumida a partir de P1 (vocabulário) e P3 (módulos); só armazenada aqui
  vocab                 jsonb not null default '{}',
  duracao_padrao_min    int not null check (duracao_padrao_min between 5 and 720),
  ciclo_padrao_dias     int not null check (ciclo_padrao_dias between 1 and 365),
  modulos_padrao        jsonb not null default '{}',
  campos_ficha          jsonb not null default '[]',
  mensagens             jsonb not null default '[]',
  ativa                 boolean not null default true,
  posicao               int not null default 0,
  created_at            timestamptz not null default now()
);

alter table professions enable row level security;
alter table professions force row level security;
create policy professions_read on professions for select using (true);

create table profession_services (
  id                    uuid primary key default gen_random_uuid(),
  profession_id         uuid not null references professions(id) on delete cascade,
  nome                  text not null,
  duracao_min           int not null check (duracao_min between 5 and 720),
  preco_sugerido_cents  bigint not null check (preco_sugerido_cents >= 0),
  ciclo_dias            int check (ciclo_dias between 1 and 365),
  posicao               int not null default 0
);
create index on profession_services (profession_id);

alter table profession_services enable row level security;
alter table profession_services force row level security;
create policy profession_services_read on profession_services for select using (true);

-- ---------------------------------------------------------------------
-- Ponte com tenants — nullable e não destrutiva (§14). `vertical` fica.
-- ---------------------------------------------------------------------
alter table tenants add column profession_id uuid references professions(id);
alter table tenants add column vocab_override jsonb not null default '{}';
create index on tenants (profession_id);

-- ---------------------------------------------------------------------
-- Seed: as 8 verticais atuais, com o MESMO slug do enum — é o que permite
-- o backfill 1:1 abaixo sem ambiguidade. Vocabulário segue o texto que já
-- está hardcoded na interface hoje (P1 é quem passa a lê-lo daqui).
-- ---------------------------------------------------------------------
insert into professions
  (slug, nome, grupo, sinonimos, onde, cobranca, inicio, ritmo, vocab, duracao_padrao_min, ciclo_padrao_dias, posicao)
values
  ('lashes','Cílios','beleza','{}','no_local','fixo','direto','avulso',
   '{"cliente":"cliente","atendimento":"atendimento","profissional":"profissional","servico":"serviço","local":"salão","agenda":"agenda"}',
   150, 21, 1),
  ('nails','Unhas','beleza','{"manicure","unheiro","unheira"}','no_local','fixo','direto','avulso',
   '{"cliente":"cliente","atendimento":"atendimento","profissional":"profissional","servico":"serviço","local":"salão","agenda":"agenda"}',
   60, 15, 2),
  ('barber','Barbearia','beleza','{"barbeiro"}','no_local','fixo','direto','avulso',
   '{"cliente":"cliente","atendimento":"atendimento","profissional":"barbeiro","servico":"serviço","local":"barbearia","agenda":"agenda"}',
   40, 21, 3),
  ('brows','Sobrancelhas','beleza','{"design de sobrancelha"}','no_local','fixo','direto','avulso',
   '{"cliente":"cliente","atendimento":"atendimento","profissional":"profissional","servico":"serviço","local":"salão","agenda":"agenda"}',
   45, 28, 4),
  ('waxing','Depilação','beleza','{}','no_local','fixo','direto','avulso',
   '{"cliente":"cliente","atendimento":"atendimento","profissional":"profissional","servico":"serviço","local":"salão","agenda":"agenda"}',
   40, 21, 5),
  ('aesthetics','Estética facial e corporal','beleza','{"esteticista"}','no_local','fixo','direto','avulso',
   '{"cliente":"cliente","atendimento":"atendimento","profissional":"profissional","servico":"serviço","local":"clínica","agenda":"agenda"}',
   60, 30, 6),
  ('tattoo','Tatuagem','beleza','{"tatuador"}','no_local','orcamento','solicitacao','sob_demanda',
   '{"cliente":"cliente","atendimento":"sessão","profissional":"tatuador","servico":"trabalho","local":"estúdio","agenda":"agenda"}',
   120, 180, 7),
  ('hair','Cabelo','beleza','{"cabeleireiro","cabeleireira"}','no_local','fixo','direto','avulso',
   '{"cliente":"cliente","atendimento":"atendimento","profissional":"profissional","servico":"serviço","local":"salão","agenda":"agenda"}',
   60, 30, 8);

-- backfill: tenants.vertical (enum) → tenants.profession_id (fk), 1:1 pelos
-- mesmos slugs. Não apaga vertical — os dois convivem até P1/P2 trocarem a
-- leitura, como o critério de aceite 6 exige.
update tenants t
set profession_id = p.id
from professions p
where p.slug = t.vertical::text
  and t.profession_id is null;
