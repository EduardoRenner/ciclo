# db-backup — snapshot Supabase de 2026-09-01

Backup offline do banco/schema/storage deste projeto no Supabase.
Gerado antes de mudar de plano. Contem PII de cliente — este repo DEVE ficar privado.

- `catalog.json` — schema completo (tabelas, RLS, funcoes, triggers, indices, migrations)
- `data.json` — todas as linhas + auth.users/identities
- `storage/` — todos os arquivos dos buckets (publicos e privados)
- `_done.json` — contagens

Restaurar: criar projeto Supabase novo -> aplicar migrations de `supabase/migrations/` -> importar `data.json` tabela a tabela -> subir `storage/` -> importar auth.users.
