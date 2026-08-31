-- Marca (nunca apaga) linhas de vault_access_log/audit_log cujo tenant não existe mais.
--
-- Achado na auditoria de 31/08: os testes de integração apontam para este banco de produção
-- (P-B.1, docs/18-MONETIZACAO-PLANO.md §P.1.1) e cada rodada cria e apaga tenant. Como as duas
-- tabelas de trilha não têm `on delete cascade` — por desenho, registro de auditoria sobrevive à
-- entidade que ele registra —, elas acumulam linha órfã: 1.029 em `vault_access_log` (100% da
-- tabela) e 33 em `audit_log`.
--
-- A regra 5.1 do CLAUDE.md ("nunca delete registro de auditoria; use estado/compensação") vale
-- também aqui. `orphaned_at` é essa compensação: sinaliza a linha sem apagá-la, para uma consulta
-- futura (ou uma rotina de arquivamento, depois que P-B.1 estiver resolvida e o lixo parar de
-- crescer) poder excluí-la do caminho quente sem perder o registro.
--
-- Nenhum tenant real enxerga estas linhas hoje: toda consulta em `trilha-cofre.ts` e no
-- `audit_log` filtra por `tenant_id = <tenant do usuário>`, e nenhum tenant vivo tem o id de um
-- tenant apagado. A coluna é puramente administrativa.
alter table vault_access_log add column orphaned_at timestamptz;
alter table audit_log add column orphaned_at timestamptz;

comment on column vault_access_log.orphaned_at is
  'Marcado quando tenant_id não corresponde a nenhum tenant vivo — lixo de teste apontando para produção (P-B.1). Nunca apagar a linha; ver migration 0050.';
comment on column audit_log.orphaned_at is
  'Marcado quando tenant_id não corresponde a nenhum tenant vivo — lixo de teste apontando para produção (P-B.1). Nunca apagar a linha; ver migration 0050.';

update vault_access_log v set orphaned_at = now()
where orphaned_at is null and not exists (select 1 from tenants t where t.id = v.tenant_id);

update audit_log a set orphaned_at = now()
where orphaned_at is null and not exists (select 1 from tenants t where t.id = a.tenant_id);
