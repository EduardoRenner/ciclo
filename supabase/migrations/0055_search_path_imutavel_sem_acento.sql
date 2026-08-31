-- Achado pelo advisor de segurança do Supabase (lint 0011, function_search_path_mutable):
-- `imutavel_sem_acento` (migration 0047) não tinha `search_path` fixado. Não é SECURITY DEFINER
-- (baixo risco de escalada), mas é IMMUTABLE e usada numa coluna GERADA — pinar o `search_path`
-- é o hardening padrão para função `SECURITY INVOKER` também, e custa zero: não muda
-- comportamento (a função só chama `lower`/`unaccent`, ambos resolvidos em `pg_catalog`/
-- `public`), não precisa recriar a coluna gerada nem o índice.
alter function public.imutavel_sem_acento(text) set search_path = pg_catalog, public;
