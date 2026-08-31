-- Achado pelo advisor de performance do Supabase (lint 0001, unindexed_foreign_keys) na mesma
-- tarde em que `portfolio_photos` nasceu (migration 0053): as duas FKs (`client_id`,
-- `source_media_id`) não tinham índice cobrindo a COLUNA COMO PRIMEIRA — `portfolio_photos_tenant_idx`
-- e `portfolio_photos_client_idx` (ambos com `tenant_id` na frente) não servem pra isso. Sem
-- índice líder na FK, apagar uma `clients`/`media` referenciada faz o Postgres varrer a tabela
-- inteira pra achar linhas dependentes — e `despublicarTudoDoCliente`/`deletarMedia`
-- (`docs/35-FOTOS-CONSENTIMENTO-PLANO.md`) fazem exatamente esse tipo de consulta.
create index portfolio_photos_client_id_idx on portfolio_photos (client_id);
create index portfolio_photos_source_media_id_idx on portfolio_photos (source_media_id) where source_media_id is not null;
