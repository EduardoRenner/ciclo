-- Achado ao ligar o CI pela primeira vez (S13, 2026-08-24), continuação da correção anterior.
--
-- `supabase start` (o stack efêmero do job "Banco e RLS") nunca tinha rodado uma única vez desde
-- que este projeto existe: esta máquina não tem Docker, então nem o desenvolvimento original nem
-- nenhuma sessão anterior jamais aplicaram as 37 migrations num banco vazio de verdade — o
-- desenvolvimento sempre rodou contra o projeto na nuvem (docs/DECISOES.md, 2026-08-17), que já
-- nasceu com os GRANT de baixo nível que o painel do Supabase aplica automaticamente na criação
-- de todo projeto novo. Essa concessão nunca foi declarada em migration nenhuma — não porque
-- alguém esqueceu, mas porque nunca precisou: o projeto real já vinha com ela.
--
-- O sintoma, na primeira execução real do CI: `permission denied for table professions`,
-- `job_queue`, `rate_limits` — não é RLS (que devolveria zero linhas em silêncio, não erro), é a
-- ausência do GRANT que autoriza a `service_role`/`authenticated`/`anon` sequer TENTAR consultar
-- a tabela antes de a RLS entrar em jogo. Nenhuma tabela deste schema, nova ou antiga, tinha essa
-- concessão declarada — as mais antigas só funcionavam porque o projeto de produção já vinha com
-- ela; um `supabase start` do zero não tem de onde herdar isso.
--
-- ## Por que TABELA entra aqui e FUNÇÃO não — e por que isso quase deu errado
--
-- No Postgres, uma tabela nova não concede nada a ninguém por padrão — é por isso que este
-- arquivo existe. Uma FUNÇÃO nova é o oposto: ganha `EXECUTE` para `PUBLIC` automaticamente, a
-- não ser que alguém revogue. **Dez migrations deste projeto** — incluindo a correção original
-- do achado de segurança mais grave já encontrado aqui (`apply_vertical_pack`, migration 0004) e
-- três das correções desta própria auditoria (0034, 0035, 0037) — existem exatamente para
-- revogar esse padrão de `PUBLIC` de função sensível. Um `grant execute on all functions ...`
-- aqui reabriria as dez de uma vez, silenciosamente, porque GRANT e REVOKE são só mutações
-- cumulativas na mesma lista de permissões — não importa a ordem, o último a rodar vale. Por
-- isso esta migration toca só TABELA e SEQUÊNCIA, nunca FUNÇÃO.
--
-- ## Por que estas concessões de tabela são seguras
--
-- `service_role` sempre ignora RLS por natureza — dar-lhe GRANT amplo aqui só formaliza o que a
-- chave já significa (e ela é confinada a `with-tenant.ts`, com regra de lint própria). `anon` e
-- `authenticated` recebem CRUD de tabela porque a RLS de TODAS as 50 tabelas deste schema está
-- `force`ada (conferido na Fase N da auditoria) — GRANT sem RLS seria perigoso; RLS sem GRANT é
-- o que este projeto tinha até agora, que não deixa nem um `select` correr. Nas quatro tabelas
-- "negadas por design" (`job_queue`, `rate_limits`, `idempotency_keys`, `webhook_events`,
-- `cron_heartbeats`), zero políticas com RLS forçada nega tudo para `anon`/`authenticated`
-- independente do GRANT de tabela — é o comportamento que o teste de isolamento já cobra.
--
-- ## Por que isto não muda nada em produção
--
-- `grant` é idempotente. No projeto real, que já nasceu com esta base, esta migration não altera
-- nenhum comportamento observável; ela só torna explícito, versionado e reproduzível o que até
-- agora vivia só na configuração implícita do painel. É o que faz `supabase start` — e por
-- extensão o CI inteiro — funcionar de verdade pela primeira vez.
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Para toda tabela/sequência que uma migration FUTURA vier a criar — sem isto, o problema desta
-- migration reapareceria na próxima tabela nova aplicada num banco vazio. Função de propósito
-- fora daqui, pelo mesmo motivo do bloco acima.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
