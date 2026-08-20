-- =====================================================================
-- CICLO · Índices para FKs que só tinham índice composto começando por
-- outra coluna (ou nenhum índice)
--
-- Achado ao limpar o resíduo de teste do banco antes do TICKET-059
-- (docs/09-PLATAFORMA.md §1.1/P−1, docs/DECISOES.md 2026-08-19): apagar um
-- tenant com 10 mil clientes travava em `statement timeout`. Causa: o
-- mecanismo de ON DELETE CASCADE/SET NULL do Postgres consulta a tabela
-- filha só pela coluna da FK — client_cycles.client_id tinha índice, mas
-- composto começando por tenant_id (pkey (tenant_id, client_id,
-- service_id)), inútil para uma busca só por client_id; appointments
-- tinha o mesmo problema; clients.referred_by não tinha índice nenhum.
-- Cada linha apagada disparava varredura sequencial de uma tabela com
-- 300k+ linhas. Vale para qualquer exclusão em lote futura — LGPD,
-- cancelamento de conta — não só para a limpeza de hoje.
-- =====================================================================
create index if not exists client_cycles_client_id_idx on client_cycles (client_id);
create index if not exists appointments_client_id_idx on appointments (client_id);
create index if not exists clients_referred_by_idx on clients (referred_by) where referred_by is not null;
