-- CICLO · o ciclo por sujeito, passo 1 de 3 (docs/105-ciclo/C-022/01-plano.md; AUT-101)
--
-- ADITIVA: sobe ANTES do código que grava com o sujeito. Nada muda para a beleza: toda linha existente
-- fica com `subject_id` nulo, e a chave nova trata nulo como IGUAL (`nulls not distinct`), então
-- (Ana, corte, nulo) continua sendo uma linha só e o upsert do job continua batendo nela.
-- A chave primária antiga (tenant, cliente, serviço) só cai na 0135, DEPOIS do deploy do passo 2.

alter table client_cycles add column subject_id uuid;

-- Ciclo é estado DERIVADO (o job recalcula), não histórico: sujeito que sai leva o ciclo dele.
alter table client_cycles add constraint client_cycles_subject_fk
  foreign key (tenant_id, subject_id) references subjects (tenant_id, id) on delete cascade;

create unique index client_cycles_chave_por_sujeito on client_cycles (tenant_id, client_id, service_id, subject_id)
  nulls not distinct;

-- Prefixo da FK composta (guarda indices-fk).
create index client_cycles_subject_idx on client_cycles (tenant_id, subject_id);
