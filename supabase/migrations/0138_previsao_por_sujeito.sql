-- CICLO · a trilha de previsões por sujeito, passo 1 (docs/105-ciclo/C-030; AUT-101)
--
-- ADITIVA, antes do deploy. Desde o C-023 o ciclo do animal/carro existe, mas a trilha de previsões
-- (docs/46, a prestação de contas do Motor) só recebia o ciclo SEM sujeito: o Motor não media o próprio
-- acerto justamente na expansão. Com sujeito nulo (beleza), `nulls not distinct` mantém uma linha por
-- (cliente, serviço, visita), como hoje. A chave antiga de 4 colunas cai na 0139, DEPOIS do código no ar
-- (dois animais banhados no mesmo dia colidiriam nela).

alter table cycle_predictions add column subject_id uuid;

alter table cycle_predictions add constraint cycle_predictions_subject_fk
  foreign key (tenant_id, subject_id) references subjects (tenant_id, id) on delete cascade;

create unique index cycle_predictions_uma_por_visita_e_sujeito
  on cycle_predictions (tenant_id, client_id, service_id, subject_id, last_visit_on) nulls not distinct;

-- Prefixo da FK composta (guarda indices-fk).
create index cycle_predictions_subject_idx on cycle_predictions (tenant_id, subject_id);
