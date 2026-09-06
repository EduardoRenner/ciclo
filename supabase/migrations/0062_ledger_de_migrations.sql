-- Por que o app precisa LER a própria lista de migrations aplicadas.
--
-- Em 05/09/2026, tres migrations (0059, 0060 e 0061) estavam no repositorio, no `main`, com o
-- codigo que depende delas JA NO AR -- e nenhuma aplicada em producao. O efeito nao era teorico:
-- `pedido-de-orcamento.ts` insere em `quotes` com `professional_id = null` e `status =
-- 'requested'`, e as duas coisas violavam a coluna `not null` e o CHECK antigo. Quem pedisse
-- orcamento pela pagina publica levava erro. E o `vocab` de 10 profissoes seguia so no masculino,
-- chamando a barbeira de "barbeiro" -- o T8 do docs/20.
--
-- O que deixou isso passar por dias sem ninguem ver: o `docs/05-FAQ-DEV.md` B24 respondia "Migration
-- roda por GitHub Action com `supabase db push`, antes do deploy do app". Essa Action NUNCA
-- existiu -- ha dois workflows no repositorio, `ci.yml` e `cron.yml`, e nenhum aplica migration em
-- producao. E o mesmo defeito do B23 (que prometia um guard no `package.json` que nao existia):
-- promessa de processo falsa e pior que a ausencia dela, porque quem le age com a confianca de
-- quem tem rede.
--
-- Construir a Action de verdade exige credencial nova (access token da Supabase + senha do banco),
-- que e decisao do dono. O que NAO exige credencial nova: o app ja tem `service_role` em producao,
-- entao ele mesmo pode conferir se o banco esta atras do codigo -- e o `/api/health` ja e batido
-- seis vezes por dia pelo job `vigia` do `cron.yml`, que fica VERMELHO quando o relatorio nao esta
-- ok. O alarme que faltava ja tem quem toque.
--
-- `security definer` porque o `service_role` nao tem `usage` no schema `supabase_migrations`
-- (medido), e dar esse acesso amplo para ler uma coluna seria trocar um problema por outro.
-- `search_path` fixo pelo lint 0011 do advisor, igual a 0055.
create or replace function public.migracoes_aplicadas()
returns table (name text)
language sql
stable
security definer
set search_path = pg_catalog, public, supabase_migrations
as $$
  select m.name
  from supabase_migrations.schema_migrations m
  where m.name is not null
$$;

-- Nome de migration descreve funcionalidade ("0061_pedido_de_orcamento"), entao isto nao vai para
-- `anon` nem `authenticated`: so quem ja e `service_role` (o `/api/health`, que roda no servidor).
revoke all on function public.migracoes_aplicadas() from public;
revoke all on function public.migracoes_aplicadas() from anon;
revoke all on function public.migracoes_aplicadas() from authenticated;
grant execute on function public.migracoes_aplicadas() to service_role;
