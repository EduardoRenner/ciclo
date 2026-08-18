-- TICKET-050: uma anamnese ativa por (tenant, cliente, formulário) — o
-- upsert de salvarRespostas() precisa desse índice único para atualizar em
-- vez de duplicar quando a cliente preenche o mesmo formulário de novo.
create unique index if not exists health_records_unique_form
  on health_records (tenant_id, client_id, form_key);
