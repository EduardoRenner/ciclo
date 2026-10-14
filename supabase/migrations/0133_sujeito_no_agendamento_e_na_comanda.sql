-- CICLO · as colunas que ligam agendamento e item de comanda ao SUJEITO (AUT-101, docs/105-ciclo/C-021)
--
-- NULÁVEIS: beleza segue com nulo, nada muda. Chave COMPOSTA com o tenant: um agendamento de um salão não
-- aponta para o carro de outro salão nem sabendo o id. `on delete set null (subject_id)` zera só a coluna
-- do sujeito, nunca o tenant (Postgres 15+). Sem cascade nenhum: agendamento é histórico e nunca some.

alter table appointments add column subject_id uuid;
alter table appointments add constraint appointments_subject_fk
  foreign key (tenant_id, subject_id) references subjects (tenant_id, id) on delete set null (subject_id);
-- Índice pelo PREFIXO da FK composta (guarda `indices-fk`): sem ele, mexer no sujeito varre a tabela inteira.
create index appointments_subject_idx on appointments (tenant_id, subject_id);

alter table ticket_items add column subject_id uuid;
alter table ticket_items add constraint ticket_items_subject_fk
  foreign key (tenant_id, subject_id) references subjects (tenant_id, id) on delete set null (subject_id);
create index ticket_items_subject_idx on ticket_items (tenant_id, subject_id);
